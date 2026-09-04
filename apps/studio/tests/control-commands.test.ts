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
  buildFullscreenRequest,
  buildFullscreenRequestPath,
  buildSlideCommand,
  buildSlideCommandPath,
  buildSlideAckPath,
  type ControlAction,
} from "../src/features/control/control-commands";
import {
  writeControlCommand,
  writeControlState,
  writeFullscreenRequest,
  writeSlideCommand,
  writeScriptedInput,
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

  it("builds the fullscreen request path and shape", () => {
    expect(buildFullscreenRequestPath()).toBe("live/fullscreenRequest");
    expect(buildFullscreenRequest(2, "version-1", 3)).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 3,
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

  it("writes Scripted inputs at the exact address with transactional revisions", async () => {
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "user" });
    const request = { activationRevision: 7, currentVersionId: "v", pageId: "p", scriptedSlot: 2, elementId: " element/# ", portIndex: 3, portId: " port.$ ", targetBootId: "boot", targetMountRevision: 4, value: 0.12 } as const;
    const first = await writeScriptedInput({} as never, request);
    expect(mocks.ref).toHaveBeenCalledWith(expect.anything(), "live/scriptedInput/2/3");
    expect(first).toMatchObject({ revision: 1, value: .12, elementId: " element/# ", portId: " port.$ " });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => ({ committed: true, snapshot: { val: () => updater({ ...first, revision: 1 }) } }));
    expect((await writeScriptedInput({} as never, { ...request, value: true })).revision).toBe(2);
    mocks.runTransaction.mockImplementation(async (_ref, updater) => ({ committed: true, snapshot: { val: () => updater({ ...first, revision: 4 }) } }));
    expect((await writeScriptedInput({} as never, request)).revision).toBe(5);
    expect((await writeScriptedInput({} as never, { ...request, targetMountRevision: 5 })).revision).toBe(1);
    expect((await writeScriptedInput({} as never, { ...request, targetBootId: "other" })).revision).toBe(1);
    await expect(writeScriptedInput({} as never, { ...request, targetMountRevision: 0 })).rejects.toThrow("targetMountRevision");
    await expect(writeScriptedInput({} as never, { ...request, targetMountRevision: 1.5 })).rejects.toThrow("targetMountRevision");
    await expect(writeScriptedInput({} as never, { ...request, value: Number.NaN })).rejects.toThrow("finite");
    await expect(writeScriptedInput({} as never, { ...request, value: Infinity })).rejects.toThrow("finite");
    mocks.getCurrentNonAnonymousUser.mockReturnValue(null);
    await expect(writeScriptedInput({} as never, request)).rejects.toThrow("authenticated");
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

describe("control state writer", () => {
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

  it("writes to the live/controlState path with revision 1 on a new activation", async () => {
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater(null) as Record<string, unknown>;
      expect(result).toEqual({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-b",
      });
      return { committed: true, snapshot: { val: () => result } };
    });

    const committed = await writeControlState(
      {} as never,
      2,
      "version-1",
      "page-b",
    );

    expect(mocks.ref).toHaveBeenCalledWith({}, "live/controlState");
    expect(committed).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-b",
    });
  });

  it("increments the control revision within the same activation", async () => {
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 8,
        pageId: "page-a",
      }) as Record<string, unknown>;
      expect(result).toEqual({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 9,
        pageId: "page-c",
      });
      return { committed: true, snapshot: { val: () => result } };
    });

    const committed = await writeControlState(
      {} as never,
      2,
      "version-1",
      "page-c",
    );

    expect(committed).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-c",
    });
  });

  it("aborts the control revision transaction when the live identity changes", async () => {
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const result = updater({
        activationRevision: 2,
        currentVersionId: "version-old",
        revision: 8,
        pageId: "page-a",
      });
      expect(result).toBeUndefined();
      return {
        committed: false,
        snapshot: {
          val: () => ({
            activationRevision: 2,
            currentVersionId: "version-old",
            revision: 8,
            pageId: "page-a",
          }),
        },
      };
    });

    await expect(
      writeControlState({} as never, 2, "version-new", "page-a"),
    ).rejects.toThrow(/did not commit/);
  });
});

describe("fullscreen request writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "https://example.firebaseio.com");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "domain");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "bucket");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "sender");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "app");
    mocks.getApps.mockReturnValue([]);
    mocks.initializeApp.mockReturnValue({});
    mocks.getDatabase.mockReturnValue({});
    mocks.ref.mockImplementation((_db, path: string) => ({ path }));
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "user-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("starts at revision 1 and increments a matching request", async () => {
    const expectedLive = {
      publicationId: "publication-1",
      currentVersionId: "version-1",
      revision: 2,
    };
    const values = [
      {
        activationRevision: 2,
        current: expectedLive,
        controlState: { revision: 4 },
        playerState: { appliedControlRevision: 4 },
        fullscreenRequest: { activationRevision: 2, currentVersionId: "version-1", revision: 3 },
      },
      {
        activationRevision: 2,
        current: expectedLive,
        controlState: { revision: 5 },
        playerState: { appliedControlRevision: 5 },
      },
    ];
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const current = values.shift();
      const result = updater(current) as Record<string, unknown>;
      return { committed: true, snapshot: { val: () => result } };
    });

    await expect(writeFullscreenRequest({} as never, expectedLive)).resolves.toMatchObject({
      revision: 4,
    });
    await expect(writeFullscreenRequest({} as never, expectedLive)).resolves.toMatchObject({
      revision: 1,
    });

    expect(mocks.ref).toHaveBeenCalledWith({}, "live");
  });

  it("retries an uncached null and writes only the fullscreen request", async () => {
    const expectedLive = {
      publicationId: "publication-1",
      currentVersionId: "version-1",
      revision: 2,
    };
    const current = {
      activationRevision: 2,
      current: expectedLive,
      controlState: { revision: 4 },
      playerState: { appliedControlRevision: 4 },
      fullscreenRequest: { activationRevision: 2, currentVersionId: "version-1", revision: 3 },
    };
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      expect(updater(null)).toBeNull();
      const result = updater(current) as Record<string, unknown>;
      return { committed: true, snapshot: { val: () => result } };
    });

    await expect(writeFullscreenRequest({} as never, expectedLive)).resolves.toMatchObject({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 4,
    });

    expect(mocks.runTransaction).toHaveBeenCalledWith(
      { path: "live" },
      expect.any(Function),
      { applyLocally: false },
    );
  });

  it("rejects when an uncached null remains the server value", async () => {
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      expect(updater(null)).toBeNull();
      return { committed: true, snapshot: { val: () => null } };
    });

    await expect(
      writeFullscreenRequest({} as never, {
        publicationId: "publication-1",
        currentVersionId: "version-1",
        revision: 2,
      }),
    ).rejects.toThrow(/changed/);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("rejects an uncached null followed by a stale identity without writing", async () => {
    const stale = {
      current: {
        publicationId: "publication-new",
        currentVersionId: "version-new",
        revision: 3,
      },
      fullscreenRequest: { activationRevision: 3, currentVersionId: "version-new", revision: 2 },
    };
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      expect(updater(null)).toBeNull();
      expect(updater(stale)).toBeUndefined();
      return { committed: false, snapshot: { val: () => stale } };
    });

    await expect(
      writeFullscreenRequest({} as never, {
        publicationId: "publication-old",
        currentVersionId: "version-old",
        revision: 2,
      }),
    ).rejects.toThrow(/changed/);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("fails closed for a stale identity without changing projection state", async () => {
    const current = {
      activationRevision: 3,
      current: {
        publicationId: "publication-new",
        currentVersionId: "version-new",
        revision: 3,
      },
      controlState: { revision: 8 },
      playerState: { appliedControlRevision: 7 },
      fullscreenRequest: { activationRevision: 3, currentVersionId: "version-new", revision: 2 },
    };
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      expect(updater(current)).toBeUndefined();
      return { committed: false, snapshot: { val: () => current } };
    });

    await expect(
      writeFullscreenRequest({} as never, {
        publicationId: "publication-old",
        currentVersionId: "version-old",
        revision: 2,
      }),
    ).rejects.toThrow(/changed/);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
