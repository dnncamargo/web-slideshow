import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  getDatabase: mocks.getDatabase,
  onValue: mocks.onValue,
  ref: mocks.ref,
}));

vi.mock("firebase/app", () => ({
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
}));

import {
  LIVE_CURRENT_PATH,
  subscribeLiveCurrent,
} from "../src/features/live/live-current-read";

const readerSource = readFileSync("src/features/live/live-current-read.ts", "utf8");

describe("live current read seam", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "https://example.firebaseio.com");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "domain");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "bucket");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "sender");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "app");
    mocks.getApps.mockReturnValue([]);
    mocks.getDatabase.mockReturnValue({});
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.onValue.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("maps valid, absent, malformed, and failed snapshots without writes", () => {
    const onState = vi.fn();
    subscribeLiveCurrent(onState);
    const [, success, failure] = mocks.onValue.mock.calls[0] as [
      unknown,
      (snapshot: { exists(): boolean; val(): unknown }) => void,
      () => void,
    ];

    expect(mocks.ref).toHaveBeenCalledWith({}, LIVE_CURRENT_PATH);
    expect(onState).toHaveBeenCalledWith({ kind: "loading" });

    success({
      exists: () => true,
      val: () => ({ publicationId: " p ", currentVersionId: " v ", revision: 1 }),
    });
    expect(onState).toHaveBeenLastCalledWith({
      kind: "active",
      live: { publicationId: "p", currentVersionId: "v", revision: 1 },
    });

    success({ exists: () => false, val: () => null });
    expect(onState).toHaveBeenLastCalledWith({ kind: "none" });
    success({ exists: () => true, val: () => ({ revision: "bad" }) });
    expect(onState).toHaveBeenLastCalledWith({ kind: "error" });
    failure();
    expect(onState).toHaveBeenLastCalledWith({ kind: "error" });
  });

  it("returns null without subscribing when RTDB is unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "");

    expect(subscribeLiveCurrent(vi.fn())).toBeNull();
    expect(mocks.onValue).not.toHaveBeenCalled();
  });

  it("returns and invokes the Firebase unsubscribe", () => {
    const unsubscribe = vi.fn();
    mocks.onValue.mockReturnValue(unsubscribe);

    const cleanup = subscribeLiveCurrent(vi.fn());
    cleanup?.();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("has no authenticated mutation coupling", () => {
    expect(readerSource).not.toMatch(
      /firebase-auth|runTransaction|\bupdate\b|\bset\b|requireAuth/,
    );
  });
});
