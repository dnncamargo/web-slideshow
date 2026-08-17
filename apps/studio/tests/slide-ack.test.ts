import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  onValue: vi.fn(),
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock("firebase/database", () => ({
  getDatabase: mocks.getDatabase,
  ref: mocks.ref,
  onValue: mocks.onValue,
}));

vi.mock("firebase/app", () => ({
  initializeApp: mocks.initializeApp,
  getApps: mocks.getApps,
  getApp: vi.fn(() => ({})),
}));

import { parseSlideAck, subscribeSlideAck } from "../src/features/control/slide-ack";

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
  mocks.onValue.mockReturnValue(vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseSlideAck", () => {
  it("accepts a well-formed ack", () => {
    expect(
      parseSlideAck({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 3,
        pageId: "slide-5",
        pageIndex: 5,
      }),
    ).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 3,
      pageId: "slide-5",
      pageIndex: 5,
    });
  });

  it("accepts a revision-zero baseline ack", () => {
    expect(
      parseSlideAck({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 0,
        pageId: "slide-0",
        pageIndex: 0,
      }),
    ).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 0,
      pageId: "slide-0",
      pageIndex: 0,
    });
  });

  it("rejects an otherwise-valid ack with an extra field", () => {
    expect(
      parseSlideAck({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 3,
        pageId: "slide-5",
        pageIndex: 5,
        extra: true,
      }),
    ).toBeNull();
    expect(
      parseSlideAck({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 0,
        pageId: "slide-0",
        pageIndex: 0,
        stale: 1,
      }),
    ).toBeNull();
  });

  it("ignores malformed values", () => {
    for (const value of [
      null,
      {},
      { activationRevision: 2, revision: 3 },
      { activationRevision: 2, revision: -1, pageId: "slide-0", pageIndex: 0 },
      { activationRevision: "x", revision: 3, pageId: "slide-0", pageIndex: 0 },
      { activationRevision: 2, revision: 1.5, pageId: "slide-0", pageIndex: 0 },
      { activationRevision: 2, revision: 3, pageId: "slide-0", pageIndex: -1 },
      { activationRevision: 2, revision: 3, pageId: "", pageIndex: 0 },
    ]) {
      expect(parseSlideAck(value)).toBeNull();
    }
  });
});

describe("subscribeSlideAck", () => {
  it("subscribes to live/slideAck and forwards only valid acks", () => {
    setupEnv();
    const cb = vi.fn();

    subscribeSlideAck(cb);

    expect(mocks.ref).toHaveBeenCalledWith({}, "live/slideAck");

    const handler = mocks.onValue.mock.calls[0]?.[1] as (snapshot: unknown) => void;

    handler({
      val: () => ({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "slide-4",
        pageIndex: 4,
      }),
    });
    expect(cb).toHaveBeenCalledTimes(1);

    handler({
      val: () => ({ activationRevision: 2, revision: "x", pageId: "slide-0", pageIndex: 0 }),
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("returns null when RTDB is not configured", () => {
    expect(subscribeSlideAck(vi.fn())).toBeNull();
  });
});
