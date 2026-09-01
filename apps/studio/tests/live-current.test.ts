import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
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
  update: mocks.update,
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
  mocks.update.mockResolvedValue(undefined);
  mocks.runTransaction.mockImplementation(
    async (_ref: unknown, updater: (current: unknown) => unknown) => ({
      committed: true,
      snapshot: { val: () => updater(null) },
    }),
  );
  mocks.onValue.mockReturnValue(vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

import {
  activateLivePresentation,
  endLivePresentation,
  promoteLivePresentationVersion,
  readLiveCurrent,
  subscribeLiveCurrent,
} from "../src/features/control/live-current";

describe("live-current activation", () => {
  it("runs a single transaction at /live for activation", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater(null) as Record<string, unknown>;
      return { committed: true, snapshot: { val: () => result } };
    });

    await activateLivePresentation("pub-1", "ver-1");

    expect(mocks.ref).toHaveBeenCalledWith({}, "live");
  });

  it("first activation writes activationRevision 1 and current revision 1", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    const box: { committed: Record<string, unknown> | null } = { committed: null };
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      box.committed = updater(null) as Record<string, unknown>;
      return { committed: true, snapshot: { val: () => box.committed } };
    });

    await activateLivePresentation("pub-1", "ver-1");

    const committed = box.committed as Record<string, unknown>;
    const current = committed.current as Record<string, unknown>;
    expect(committed.activationRevision).toBe(1);
    expect(current.publicationId).toBe("pub-1");
    expect(current.currentVersionId).toBe("ver-1");
    expect(current.revision).toBe(1);
  });

  it("malformed activationRevision yields 1", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    const box: { committed: Record<string, unknown> | null } = { committed: null };
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      box.committed = updater({ activationRevision: "bad", current: {} }) as Record<
        string,
        unknown
      >;
      return { committed: true, snapshot: { val: () => box.committed } };
    });

    await activateLivePresentation("pub-1", "ver-1");

    const committed = box.committed as Record<string, unknown>;
    expect(committed.activationRevision).toBe(1);
  });

  it("existing activationRevision 4 increments to 5", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    const box: { committed: Record<string, unknown> | null } = { committed: null };
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      box.committed = updater({ activationRevision: 4 }) as Record<string, unknown>;
      return { committed: true, snapshot: { val: () => box.committed } };
    });

    await activateLivePresentation("pub-1", "ver-1");

    const committed = box.committed as Record<string, unknown>;
    expect(committed.activationRevision).toBe(5);
  });

  it("resulting transaction value atomically contains the full live structure", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    const box: { committed: Record<string, unknown> | null } = { committed: null };
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      box.committed = updater({ activationRevision: 3, current: {} }) as Record<
        string,
        unknown
      >;
      return { committed: true, snapshot: { val: () => box.committed } };
    });

    await activateLivePresentation("pub-1", "ver-1");

    const committed = box.committed as Record<string, unknown>;
    const current = committed.current as Record<string, unknown>;
    expect(Object.keys(committed).sort()).toEqual([
      "activationRevision",
      "controlState",
      "current",
      "fullscreenRequest",
      "galleryControl",
      "playerPresence",
      "playerState",
      "slideAck",
      "slideCommand",
    ]);
    expect(committed.activationRevision).toBe(4);
    expect(current.revision).toBe(4);
    expect(current.publicationId).toBe("pub-1");
    expect(current.currentVersionId).toBe("ver-1");
    expect(committed.slideCommand).toBeNull();
    expect(committed.slideAck).toBeNull();
    expect(committed.fullscreenRequest).toBeNull();
    expect(committed.playerPresence).toBeNull();
  });

  it("rejects when the activation transaction does not commit", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });
    mocks.runTransaction.mockResolvedValue({
      committed: false,
      snapshot: { val: () => null },
    });

    await expect(activateLivePresentation("pub-1", "ver-1")).rejects.toThrow(
      /commit/,
    );
  });

  it("continues incrementing activationRevision after an end that preserves it", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });

    await endLivePresentation();

    const box: { committed: Record<string, unknown> | null } = { committed: null };
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      box.committed = updater({ activationRevision: 4 }) as Record<string, unknown>;
      return { committed: true, snapshot: { val: () => box.committed } };
    });

    await activateLivePresentation("pub-1", "ver-1");

    const committed = box.committed as Record<string, unknown>;
    expect(committed.activationRevision).toBe(5);
  });

  it("end clears current, presence, projection protocol state, and galleryControl but preserves activationRevision", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u1", isAnonymous: false });

    await endLivePresentation();

    expect(mocks.update).toHaveBeenCalledWith(
      { path: "live" },
      {
        current: null,
        controlState: null,
        playerState: null,
        playerPresence: null,
        fullscreenRequest: null,
        galleryControl: null,
        slideCommand: null,
        slideAck: null,
      },
    );
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("promotes the version without changing activation revision and clears stale protocol state atomically", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({
      uid: "u1",
      isAnonymous: false,
    });
    const previous = {
      activationRevision: 7,
      current: {
        publicationId: "pub-1",
        currentVersionId: "ver-1",
        revision: 7,
      },
      controlState: { revision: 4 },
      playerState: { revision: 4 },
      playerPresence: { bootId: "old-boot" },
      slideCommand: { revision: 4 },
      slideAck: { revision: 4 },
      fullscreenRequest: { revision: 4 },
    };
    let committed: unknown;
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      committed = updater(previous);
      return { committed: true, snapshot: { val: () => committed } };
    });

    await promoteLivePresentationVersion(previous.current, "ver-2");

    expect(mocks.ref).toHaveBeenCalledWith({}, "live");
    expect(committed).toEqual({
      activationRevision: 7,
      current: {
        publicationId: "pub-1",
        currentVersionId: "ver-2",
        revision: 7,
      },
      controlState: null,
      playerState: null,
      playerPresence: null,
      slideCommand: null,
      slideAck: null,
      fullscreenRequest: null,
      galleryControl: null,
    });
  });

  it("continues an uncached transaction after the initial local null", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({
      uid: "u1",
      isAnonymous: false,
    });
    const previous = {
      activationRevision: 13,
      current: {
        publicationId: "pub-1",
        currentVersionId: "ver-1",
        revision: 13,
      },
      controlState: { revision: 4 },
      playerState: { revision: 4 },
      playerPresence: { bootId: "old-boot" },
      slideCommand: { revision: 4 },
      slideAck: { revision: 4 },
      fullscreenRequest: { revision: 4 },
    };
    let committed: unknown;
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      expect(updater(null)).toBeNull();
      committed = updater(previous);
      return { committed: true, snapshot: { val: () => committed } };
    });

    await promoteLivePresentationVersion(previous.current, "ver-2");

    expect(mocks.runTransaction).toHaveBeenCalledWith(
      { path: "live" },
      expect.any(Function),
      { applyLocally: false },
    );
    expect(committed).toEqual({
      activationRevision: 13,
      current: {
        publicationId: "pub-1",
        currentVersionId: "ver-2",
        revision: 13,
      },
      controlState: null,
      playerState: null,
      playerPresence: null,
      slideCommand: null,
      slideAck: null,
      fullscreenRequest: null,
      galleryControl: null,
    });
  });

  it("rejects when the server also has no active session after an uncached null", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({
      uid: "u1",
      isAnonymous: false,
    });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      expect(updater(null)).toBeNull();
      return { committed: true, snapshot: { val: () => null } };
    });

    await expect(
      promoteLivePresentationVersion(
        {
          publicationId: "pub-1",
          currentVersionId: "ver-1",
          revision: 13,
        },
        "ver-2",
      ),
    ).rejects.toThrow(/changed/);
  });

  it("still rejects a changed server session after an uncached null", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({
      uid: "u1",
      isAnonymous: false,
    });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      expect(updater(null)).toBeNull();
      expect(
        updater({
          activationRevision: 14,
          current: {
            publicationId: "pub-1",
            currentVersionId: "ver-1",
            revision: 14,
          },
        }),
      ).toBeUndefined();
      return { committed: false, snapshot: { val: () => null } };
    });

    await expect(
      promoteLivePresentationVersion(
        {
          publicationId: "pub-1",
          currentVersionId: "ver-1",
          revision: 13,
        },
        "ver-2",
      ),
    ).rejects.toThrow(/changed/);
  });

  it("treats a retry after the target is active as a no-op", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({
      uid: "u1",
      isAnonymous: false,
    });
    const current = {
      activationRevision: 7,
      current: {
        publicationId: "pub-1",
        currentVersionId: "ver-2",
        revision: 7,
      },
      controlState: null,
      playerState: null,
      slideCommand: { currentVersionId: "ver-2", revision: 1 },
      slideAck: { currentVersionId: "ver-2", revision: 1 },
      fullscreenRequest: { currentVersionId: "ver-2", revision: 1 },
    };
    let updateResult: unknown = "not-called";
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      expect(updater(null)).toBeNull();
      updateResult = updater(current);
      return { committed: false, snapshot: { val: () => current } };
    });

    await expect(
      promoteLivePresentationVersion(
        {
          publicationId: "pub-1",
          currentVersionId: "ver-1",
          revision: 7,
        },
        "ver-2",
      ),
    ).resolves.toBeUndefined();

    expect(updateResult).toBeUndefined();
  });

  it("rejects a stale promotion after the active session changes", async () => {
    setupEnv();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({
      uid: "u1",
      isAnonymous: false,
    });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      updater({
        activationRevision: 8,
        current: {
          publicationId: "pub-1",
          currentVersionId: "ver-1",
          revision: 8,
        },
      });
      return { committed: false, snapshot: { val: () => null } };
    });

    await expect(
      promoteLivePresentationVersion(
        {
          publicationId: "pub-1",
          currentVersionId: "ver-1",
          revision: 7,
        },
        "ver-2",
      ),
    ).rejects.toThrow(/changed/);
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
