import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({
  onValue: vi.fn(),
  ref: vi.fn(),
  set: vi.fn(),
  cancelAnimationFrame: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  onValue: mocks.onValue,
  ref: mocks.ref,
  set: mocks.set,
}));

import {
  CONTROL_STATE_PATH,
  PLAYER_STATE_PATH,
  parseLiveControlState,
  parseLivePlayerState,
  subscribeLiveProjectionState,
} from "../src/live-state";

let rafCallbacks: Map<number, FrameRequestCallback>;
let rafId: number;

function snapshot(val: unknown) {
  return { val: () => val };
}

function presentation(ids: string[]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    description: "",
    aspectRatio: "16:9",
    slides: ids.map((id) => ({
      id,
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [],
    })),
  });
}

function controller(initialIndex: number) {
  let index = initialIndex;

  return {
    next: vi.fn(),
    previous: vi.fn(),
    fullscreen: vi.fn(async () => undefined),
    destroy: vi.fn(),
    goTo: vi.fn((nextIndex: number) => {
      index = nextIndex;
    }),
    setGalleryActiveIndex: vi.fn(),
    setGalleryExpanded: vi.fn(),
    getCurrentIndex: vi.fn(() => index),
  };
}

beforeEach(() => {
  rafCallbacks = new Map();
  rafId = 0;

  mocks.set.mockReset();
  mocks.set.mockResolvedValue(undefined);
  mocks.onValue.mockReset();
  mocks.onValue.mockReturnValue(vi.fn());
  mocks.ref.mockReset();
  mocks.ref.mockImplementation((_db, path: string) => ({ path }));
  mocks.cancelAnimationFrame.mockReset();

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafId += 1;
    rafCallbacks.set(rafId, cb);
    return rafId;
  });

  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    mocks.cancelAnimationFrame(id);
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("paths and parsers", () => {
  it("exposes the exact RTDB paths", () => {
    expect(CONTROL_STATE_PATH).toBe("live/controlState");
    expect(PLAYER_STATE_PATH).toBe("live/playerState");
  });

  it("parses live control state", () => {
    expect(
      parseLiveControlState({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-a",
      }),
    ).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-a",
    });
  });

  it("parses live player state", () => {
    expect(
      parseLivePlayerState({
        activationRevision: 2,
        currentVersionId: "version-1",
        appliedControlRevision: 3,
        pageId: "page-c",
        pageIndex: 2,
      }),
    ).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      appliedControlRevision: 3,
      pageId: "page-c",
      pageIndex: 2,
    });
  });
});

describe("subscribeLiveProjectionState", () => {
  it("publishes the baseline player state and subscribes to live/controlState", () => {
    const liveController = controller(0);

    subscribeLiveProjectionState(
      {} as never,
      7,
      "version-1",
      presentation(["page-a", "page-b", "page-c"]),
      liveController,
    );

    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/playerState" },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        appliedControlRevision: 0,
        pageId: "page-a",
        pageIndex: 0,
      },
    );

    expect(mocks.onValue).toHaveBeenCalledWith(
      { path: "live/controlState" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("navigates to a newer controlState by pageId and publishes after RAF", async () => {
    const liveController = controller(0);

    subscribeLiveProjectionState(
      {} as never,
      7,
      "version-1",
      presentation(["page-a", "page-b", "page-c"]),
      liveController,
    );

    mocks.set.mockClear();

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      val: () => unknown;
    }) => void;

    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-b",
      }),
    );

    expect(liveController.goTo).toHaveBeenCalledWith(1);

    const frame = [...rafCallbacks.values()][0];
    expect(frame).toBeDefined();

    (frame as FrameRequestCallback)(0);
    rafCallbacks.clear();

    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/playerState" },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        appliedControlRevision: 1,
        pageId: "page-b",
        pageIndex: 1,
      },
    );
  });

  it("ignores an unknown pageId without navigating or falsely confirming", () => {
    const liveController = controller(0);

    subscribeLiveProjectionState(
      {} as never,
      7,
      "version-1",
      presentation(["page-a", "page-b", "page-c"]),
      liveController,
    );

    mocks.set.mockClear();

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      val: () => unknown;
    }) => void;

    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-x",
      }),
    );

    expect(liveController.goTo).not.toHaveBeenCalled();
    expect([...rafCallbacks.values()]).toHaveLength(0);
    expect(
      mocks.set.mock.calls.filter((call) => call[0]?.path === "live/playerState"),
    ).toHaveLength(0);
  });

  it("ignores stale activation, version, and older revisions", () => {
    const liveController = controller(0);

    subscribeLiveProjectionState(
      {} as never,
      7,
      "version-1",
      presentation(["page-a", "page-b", "page-c"]),
      liveController,
    );

    mocks.set.mockClear();

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      val: () => unknown;
    }) => void;

    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-b",
      }),
    );

    const frame = [...rafCallbacks.values()][0];
    expect(frame).toBeDefined();
    (frame as FrameRequestCallback)(0);
    rafCallbacks.clear();

    handler(
      snapshot({
        activationRevision: 99,
        currentVersionId: "version-1",
        revision: 2,
        pageId: "page-c",
      }),
    );
    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-old",
        revision: 2,
        pageId: "page-c",
      }),
    );
    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 0,
        pageId: "page-a",
      }),
    );

    expect(liveController.goTo).toHaveBeenCalledTimes(1);
    expect([...rafCallbacks.values()]).toHaveLength(0);
  });

  it("does not navigate twice for the same applied revision", () => {
    const liveController = controller(0);

    subscribeLiveProjectionState(
      {} as never,
      7,
      "version-1",
      presentation(["page-a", "page-b", "page-c"]),
      liveController,
    );

    mocks.set.mockClear();

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      val: () => unknown;
    }) => void;

    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-b",
      }),
    );

    const frame = [...rafCallbacks.values()][0];
    (frame as FrameRequestCallback)(0);
    rafCallbacks.clear();

    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-b",
      }),
    );

    expect(liveController.goTo).toHaveBeenCalledTimes(1);
  });

  it("republishes the current playerState for an already-applied revision without navigating again", () => {
    const liveController = controller(0);

    subscribeLiveProjectionState(
      {} as never,
      7,
      "version-1",
      presentation(["page-a", "page-b", "page-c"]),
      liveController,
    );

    mocks.set.mockClear();

    const handler = mocks.onValue.mock.calls[0]?.[1] as (s: {
      val: () => unknown;
    }) => void;

    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-b",
      }),
    );

    const firstFrame = [...rafCallbacks.values()][0];
    (firstFrame as FrameRequestCallback)(0);
    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/playerState" },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        appliedControlRevision: 1,
        pageId: "page-b",
        pageIndex: 1,
      },
    );
    rafCallbacks.clear();

    mocks.set.mockClear();

    handler(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-b",
      }),
    );

    expect(liveController.goTo).toHaveBeenCalledTimes(1);

    const secondFrame = [...rafCallbacks.values()][0];
    expect(secondFrame).toBeDefined();
    (secondFrame as FrameRequestCallback)(0);

    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/playerState" },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        appliedControlRevision: 1,
        pageId: "page-b",
        pageIndex: 1,
      },
    );
  });
});
