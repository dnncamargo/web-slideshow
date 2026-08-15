import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  runTransaction: vi.fn(),
  onValue: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getCurrentNonAnonymousUser: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  getDatabase: mocks.getDatabase,
  ref: mocks.ref,
  get: mocks.get,
  set: mocks.set,
  remove: mocks.remove,
  runTransaction: mocks.runTransaction,
  onValue: mocks.onValue,
}));

vi.mock("firebase/app", () => ({
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
  getApp: vi.fn(),
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: mocks.getCurrentNonAnonymousUser,
}));

function setupEnv() {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "https://example.firebaseio.com");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "key");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "domain");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "bucket");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "sender");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "app");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApps.mockReturnValue([]);
  mocks.initializeApp.mockReturnValue({});
  mocks.getDatabase.mockReturnValue({});
  mocks.ref.mockImplementation((_db: unknown, path: string) => ({ path }));
  mocks.get.mockResolvedValue({ exists: () => false, val: () => null });
  mocks.set.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.runTransaction.mockImplementation(
    async (_ref: unknown, updater: (current: unknown) => unknown) => updater(null),
  );
  mocks.onValue.mockReturnValue(vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

import {
  activateLivePresentation,
  endLivePresentation,
  readLiveCurrent,
  subscribeLiveCurrent,
} from "../src/features/control/live-current";

describe("live-current activation", () => {
  it("uses runTransaction and writes revision 1 when no existing state", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater(null);
      expect(result).toEqual({ publicationId: "pub-1", currentVersionId: "ver-1", revision: 1 });
    });

    await activateLivePresentation("pub-1", "ver-1");

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("writes revision N+1 when existing revision is N", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater({
        publicationId: "pub-old",
        currentVersionId: "ver-old",
        revision: 5,
      }) as Record<string, unknown>;
      expect(result?.revision).toBe(6);
    });

    await activateLivePresentation("pub-new", "ver-new");
  });

  it("activates same presentation again with incremented revision", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater({
        publicationId: "pub-1",
        currentVersionId: "ver-1",
        revision: 3,
      }) as Record<string, unknown>;
      expect(result?.revision).toBe(4);
      expect(result?.publicationId).toBe("pub-1");
    });

    await activateLivePresentation("pub-1", "ver-1");
  });

  it("end removes live/current", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });

    await endLivePresentation();

    expect(mocks.remove).toHaveBeenCalledWith({ path: "live/current" });
  });
});

describe("live-current parsing", () => {
  it("accepts valid live state", async () => {
    setupEnv();
    mocks.get.mockResolvedValue({
      exists: () => true,
      val: () => ({ publicationId: "pub-1", currentVersionId: "ver-1", revision: 3 }),
    });

    expect(await readLiveCurrent()).toEqual({
      publicationId: "pub-1",
      currentVersionId: "ver-1",
      revision: 3,
    });
  });

  it("returns null for absent and malformed state", async () => {
    setupEnv();
    for (const val of [null, {}, { publicationId: "" }, { publicationId: "p", currentVersionId: "" }, { publicationId: "p", currentVersionId: "v", revision: "x" }, { publicationId: "p", currentVersionId: "v", revision: -1 }, { publicationId: "p", currentVersionId: "v", revision: 1.5 }, { publicationId: "p", currentVersionId: "v", revision: NaN }, { publicationId: "p", currentVersionId: "v", revision: Infinity }]) {
      vi.clearAllMocks();
      mocks.getApps.mockReturnValue([]);
      mocks.initializeApp.mockReturnValue({});
      mocks.getDatabase.mockReturnValue({});
      mocks.ref.mockImplementation((_db: unknown, path: string) => ({ path }));
      mocks.get.mockResolvedValue({ exists: () => true, val: () => val });
      setupEnv();
      expect(await readLiveCurrent()).toBeNull();
    }
  });
});

describe("live-current subscription", () => {
  it("fires callbacks for valid, absent, and malformed state", () => {
    setupEnv();
    const cb = vi.fn();
    const onValueArg = mocks.onValue.mock;

    subscribeLiveCurrent(cb);

    const handler = onValueArg.calls[0]?.[1] as (snapshot: unknown) => void;
    const errorHandler = onValueArg.calls[0]?.[2] as () => void;

    // loading
    expect(cb).toHaveBeenCalledWith({ kind: "loading" });

    // valid active
    handler({ exists: () => true, val: () => ({ publicationId: "p", currentVersionId: "v", revision: 1 }) });
    expect(cb).toHaveBeenCalledWith({ kind: "active", live: { publicationId: "p", currentVersionId: "v", revision: 1 } });

    // absent
    handler({ exists: () => false, val: () => null });
    expect(cb).toHaveBeenCalledWith({ kind: "none" });

    // malformed
    handler({ exists: () => true, val: () => ({ revision: "x" }) });
    expect(cb).toHaveBeenCalledWith({ kind: "error" });

    // error callback
    errorHandler();
    expect(cb).toHaveBeenCalledWith({ kind: "error" });
  });

  it("unsubscribes on cleanup", () => {
    setupEnv();
    const unsub = vi.fn();
    mocks.onValue.mockReturnValue(unsub);

    const result = subscribeLiveCurrent(vi.fn());
    result!();
    expect(unsub).toHaveBeenCalled();
  });
});
