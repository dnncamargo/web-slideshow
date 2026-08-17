import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  ref: vi.fn(),
  getDatabase: vi.fn(),
  runTransaction: vi.fn(),
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getCurrentNonAnonymousUser: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  set: mocks.set,
  ref: mocks.ref,
  getDatabase: mocks.getDatabase,
  runTransaction: mocks.runTransaction,
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
  buildSlideCommand,
  buildSlideCommandPath,
  buildSlideAckPath,
  type ControlAction,
} from "../src/features/control/control-commands";
import {
  writeControlCommand,
  writeSlideCommand,
} from "../src/features/control/control-command-writer";

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

  it("builds the live slide command path and shape", () => {
    expect(buildSlideCommandPath()).toBe("live/slideCommand");
    expect(buildSlideAckPath()).toBe("live/slideAck");
    expect(buildSlideCommand(2, "version-1", 1, "slide-3")).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "slide-3",
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
    mocks.runTransaction.mockImplementation(async (_ref, updater) => ({
      committed: true,
      snapshot: { val: () => updater(null) },
    }));
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

describe("slide command writer", () => {
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
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "user-1" });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => ({
      committed: true,
      snapshot: { val: () => updater(null) },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("writes to the live/slideCommand path with revision 1 on a new activation", async () => {
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater(null) as Record<string, unknown>;
      expect(result).toEqual({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "slide-3",
      });
      return { committed: true, snapshot: { val: () => result } };
    });

    const committed = await writeSlideCommand(
      {} as never,
      2,
      "version-1",
      "slide-3",
    );

    expect(mocks.ref).toHaveBeenCalledWith({}, "live/slideCommand");
    expect(committed).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "slide-3",
    });
  });

  it("increments the command revision within the same activation", async () => {
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 4,
        pageId: "slide-1",
      }) as Record<string, unknown>;
      expect(result).toEqual({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 5,
        pageId: "slide-2",
      });
      return { committed: true, snapshot: { val: () => result } };
    });

    const committed = await writeSlideCommand(
      {} as never,
      2,
      "version-1",
      "slide-2",
    );

    expect(committed).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 5,
      pageId: "slide-2",
    });
  });

  it("restarts the command revision at 1 when the activation differs", async () => {
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater({
        activationRevision: 9,
        currentVersionId: "version-old",
        revision: 4,
        pageId: "slide-1",
      }) as Record<string, unknown>;
      expect(result).toEqual({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "slide-0",
      });
      return { committed: true, snapshot: { val: () => result } };
    });

    const committed = await writeSlideCommand(
      {} as never,
      2,
      "version-1",
      "slide-0",
    );

    expect(committed).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "slide-0",
    });
  });

  it("restarts the command revision when the live version changes", async () => {
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater({
        activationRevision: 2,
        currentVersionId: "version-old",
        revision: 4,
        pageId: "slide-1",
      }) as Record<string, unknown>;
      expect(result).toEqual({
        activationRevision: 2,
        currentVersionId: "version-new",
        revision: 1,
        pageId: "slide-2",
      });
      return { committed: true, snapshot: { val: () => result } };
    });

    await expect(
      writeSlideCommand({} as never, 2, "version-new", "slide-2"),
    ).resolves.toMatchObject({ revision: 1 });
  });

  it("fails before any SDK write when unauthenticated", async () => {
    mocks.getCurrentNonAnonymousUser.mockReturnValue(null);

    await expect(
      writeSlideCommand({} as never, 1, "version-1", "slide-0"),
    ).rejects.toThrow(
      /anonymous/,
    );
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects when the transaction does not commit", async () => {
    mocks.runTransaction.mockResolvedValue({
      committed: false,
      snapshot: {
        val: () => ({
          activationRevision: 2,
          currentVersionId: "version-1",
          revision: 1,
          pageId: "slide-0",
        }),
      },
    });

    await expect(
      writeSlideCommand({} as never, 2, "version-1", "slide-0"),
    ).rejects.toThrow(
      /did not commit/,
    );
  });

  it("rejects when the committed snapshot is malformed", async () => {
    mocks.runTransaction.mockResolvedValue({
      committed: true,
      snapshot: {
        val: () => ({
          activationRevision: 2,
          currentVersionId: "version-1",
          revision: "x",
          pageId: "slide-0",
        }),
      },
    });

    await expect(
      writeSlideCommand({} as never, 2, "version-1", "slide-0"),
    ).rejects.toThrow(
      /malformed/,
    );
  });
});
