import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  ref: vi.fn(),
  getDatabase: vi.fn(),
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getCurrentNonAnonymousUser: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  set: mocks.set,
  ref: mocks.ref,
  getDatabase: mocks.getDatabase,
}));

vi.mock("firebase/app", () => ({
  initializeApp: mocks.initializeApp,
  getApps: mocks.getApps,
  getApp: vi.fn(() => ({})),
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: mocks.getCurrentNonAnonymousUser,
}));

import {
  buildControlCommand,
  buildControlPath,
  type ControlAction,
} from "../src/features/control/control-commands";
import { writeControlCommand } from "../src/features/control/control-command-writer";

describe("control command helpers", () => {
  it("builds the exact RTDB path", () => {
    expect(buildControlPath("pub-1")).toBe("controlSpikes/pub-1");
  });

  it("builds valid next/previous command shapes", () => {
    expect(buildControlCommand("next", 3)).toEqual({ action: "next", revision: 3 });
    expect(buildControlCommand("previous", 4)).toEqual({
      action: "previous",
      revision: 4,
    });
  });
});

describe("control command writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "domain");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "bucket");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "sender");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "app");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "https://example.firebaseio.com");
    mocks.getApps.mockReturnValue([]);
    mocks.initializeApp.mockReturnValue({});
    mocks.getDatabase.mockReturnValue({});
    mocks.ref.mockImplementation((_db, path: string) => ({ path }));
    mocks.set.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("writes next to the publication path with a valid shape for an authenticated user", async () => {
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "user-1" });

    await writeControlCommand("pub-1", "next", 1);

    expect(mocks.ref).toHaveBeenCalledWith({}, "controlSpikes/pub-1");
    expect(mocks.set).toHaveBeenCalledWith(
      { path: "controlSpikes/pub-1" },
      { action: "next", revision: 1 },
    );
  });

  it("writes previous to the publication path", async () => {
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "user-1" });

    await writeControlCommand("pub-9", "previous", 5);

    expect(mocks.set).toHaveBeenCalledWith(
      { path: "controlSpikes/pub-9" },
      { action: "previous", revision: 5 },
    );
  });

  it("fails before any SDK write when unauthenticated", async () => {
    mocks.getCurrentNonAnonymousUser.mockReturnValue(null);

    await expect(writeControlCommand("pub-1", "next", 1)).rejects.toThrow(
      /anonymous/,
    );
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("rejects an empty publication id without writing", async () => {
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "user-1" });

    await expect(writeControlCommand("", "next", 1)).rejects.toThrow(
      /publicationId/,
    );
    expect(mocks.ref).not.toHaveBeenCalled();
  });
});

describe("control command actions", () => {
  it("supports only next and previous", () => {
    const actions: ControlAction[] = ["next", "previous"];

    expect(actions).toHaveLength(2);
  });
});
