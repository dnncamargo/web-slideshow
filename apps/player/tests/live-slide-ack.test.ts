import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

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
  parseSlideCommand,
  subscribeLiveSlideAck,
  type SlideCommand,
} from "../src/live-slide-ack";
import type { PlayerController } from "../src/player";

let rafCallbacks: Map<number, FrameRequestCallback>;
let rafId: number;

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

function command(
  activationRevision: number,
  revision: number,
  pageId: string,
): SlideCommand {
  return {
    activationRevision,
    currentVersionId: "version-1",
    revision,
    pageId,
  };
}

function controllerWith(index: number) {
  const getCurrentIndex = vi.fn(() => index);

  return {
    goTo: vi.fn(),
    getCurrentIndex,
  } as unknown as PlayerController & {
    getCurrentIndex: ReturnType<typeof vi.fn>;
  };
}

function handler(): (s: { val: () => unknown }) => unknown {
  return mocks.onValue.mock.calls[0]?.[1] as (s: {
    val: () => unknown;
  }) => unknown;
}

function errorHandler(): unknown {
  return mocks.onValue.mock.calls[0]?.[2];
}

function ackCalls() {
  return mocks.set.mock.calls.filter((c) => c[0]?.path === "live/slideAck");
}

describe("parseSlideCommand", () => {
  it("accepts a well-formed command", () => {
    expect(parseSlideCommand(command(3, 7, "slide-2"))).toEqual({
      activationRevision: 3,
      currentVersionId: "version-1",
      revision: 7,
      pageId: "slide-2",
    });
  });

  it("rejects non-objects and null", () => {
    expect(parseSlideCommand(null)).toBeNull();
    expect(parseSlideCommand(undefined)).toBeNull();
    expect(parseSlideCommand("next")).toBeNull();
  });

  it("rejects invalid activationRevision, revision, or pageId", () => {
    expect(
      parseSlideCommand({ activationRevision: -1, revision: 1, pageId: "slide-0" }),
    ).toBeNull();
    expect(
      parseSlideCommand({
        activationRevision: 1,
        revision: 1.5,
        pageId: "slide-0",
      }),
    ).toBeNull();
    expect(
      parseSlideCommand({ activationRevision: 1, revision: 1, pageId: "" }),
    ).toBeNull();
    expect(
      parseSlideCommand({
        activationRevision: 1,
        revision: 1,
        pageId: "slide-0",
      }),
    ).toBeNull();
    expect(
      parseSlideCommand({
        activationRevision: 1,
        revision: "1",
        pageId: "slide-0",
      }),
    ).toBeNull();
    expect(
      parseSlideCommand({
        activationRevision: 1,
        revision: 0,
        pageId: "slide-0",
      }),
    ).toBeNull();
    expect(
      parseSlideCommand({
        activationRevision: 1,
        revision: 1,
        pageId: "slide-0",
        extra: true,
      }),
    ).toBeNull();
  });
});

describe("live slide ACK subscription", () => {
  it("writes a baseline ACK on mount and subscribes to live/slideCommand", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1", "slide-2"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/slideAck" },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 0,
        pageId: "slide-0",
        pageIndex: 0,
      },
    );

    expect(mocks.onValue).toHaveBeenCalledWith(
      { path: "live/slideCommand" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("writes the baseline ACK from the already-positioned promoted page", () => {
    const controller = controllerWith(2);
    const presentationState = presentation(["slide-0", "slide-1", "slide-2"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-2",
      presentationState,
      controller,
    );

    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/slideAck" },
      {
        activationRevision: 7,
        currentVersionId: "version-2",
        revision: 0,
        pageId: "slide-2",
        pageIndex: 2,
      },
    );
  });

  it("resolves pageId to the current-version index and ACKs the actual page", () => {
    const controller = controllerWith(0);
    const current = presentation(["slide-1", "inserted", "slide-2", "slide-3"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      current,
      controller,
    );

    mocks.set.mockClear();

    handler()(snapshot(command(7, 1, "slide-3")));

    expect(controller.goTo).toHaveBeenCalledWith(3);

    const frame = [...rafCallbacks.values()][0];
    expect(frame).toBeDefined();

    controller.getCurrentIndex.mockReturnValue(3);

    (frame as FrameRequestCallback)(0);

    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/slideAck" },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "slide-3",
        pageIndex: 3,
      },
    );
  });

  it("keeps logical navigation stable across reorder and insertion", () => {
    const controller = controllerWith(1);
    const reordered = presentation(["slide-3", "inserted", "slide-1", "slide-2"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      reordered,
      controller,
    );

    mocks.set.mockClear();

    handler()(snapshot(command(7, 1, "slide-1")));

    expect(controller.goTo).toHaveBeenCalledWith(2);
  });

  it("ignores a command with the wrong activationRevision", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    handler()(snapshot(command(99, 1, "slide-1")));

    expect(controller.goTo).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);
    expect(ackCalls()).toHaveLength(1);
  });

  it("ignores a stale command from another published version", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    handler()(
      snapshot({
        ...command(7, 1, "slide-1"),
        currentVersionId: "version-old",
      }),
    );

    expect(controller.goTo).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);
    expect(ackCalls()).toHaveLength(1);
  });

  it("ignores a missing pageId without confirming a different page", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    mocks.set.mockClear();

    handler()(
      snapshot({
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "missing",
      }),
    );

    expect(controller.goTo).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);
    expect(ackCalls()).toHaveLength(0);
  });

  it("ignores a revision older than the last applied", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1", "slide-2"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    handler()(snapshot(command(7, 2, "slide-2")));

    rafCallbacks.forEach((cb) => cb(0));
    rafCallbacks.clear();

    handler()(snapshot(command(7, 1, "slide-1")));

    expect(controller.goTo).toHaveBeenCalledTimes(1);
    expect(rafCallbacks.size).toBe(0);
  });

  it("does not navigate again and re-ACKs the current page for an equal revision", () => {
    const controller = controllerWith(3);
    const presentationState = presentation(["slide-0", "slide-1", "slide-2", "slide-3"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    mocks.set.mockClear();

    handler()(snapshot(command(7, 5, "slide-2")));

    rafCallbacks.forEach((cb) => cb(0));
    rafCallbacks.clear();

    expect(controller.goTo).toHaveBeenCalledTimes(1);

    handler()(snapshot(command(7, 5, "slide-3")));

    expect(controller.goTo).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/slideAck" },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 5,
        pageId: "slide-3",
        pageIndex: 3,
      },
    );
  });

  it("ACKs only the newest revision when a newer command arrives before the frame", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1", "slide-2", "slide-3", "slide-4"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    mocks.set.mockClear();

    handler()(snapshot(command(7, 1, "slide-2")));
    handler()(snapshot(command(7, 2, "slide-4")));

    expect(controller.goTo).toHaveBeenCalledTimes(2);
    expect(rafCallbacks.size).toBe(1);

    controller.getCurrentIndex.mockReturnValue(4);

    rafCallbacks.forEach((cb) => cb(0));

    expect(ackCalls()).toHaveLength(1);
    expect(mocks.set).toHaveBeenCalledWith(
      { path: "live/slideAck" },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        revision: 2,
        pageId: "slide-4",
        pageIndex: 4,
      },
    );
  });

  it("ignores malformed commands", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1"]);

    subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    handler()(
      snapshot({ activationRevision: 7, revision: "x", pageId: "slide-0" }),
    );
    handler()(snapshot(null));
    handler()(
      snapshot({
        activationRevision: 7,
        revision: 1,
        pageId: "slide-1",
        extra: true,
      }),
    );

    expect(controller.goTo).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);
  });

  it("suppresses a stale ACK after teardown", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1", "slide-2"]);

    const cleanup = subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    handler()(snapshot(command(7, 1, "slide-2")));

    const pendingFrame = [...rafCallbacks.values()][0];
    expect(pendingFrame).toBeDefined();

    cleanup();

    (pendingFrame as FrameRequestCallback)(0);

    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set.mock.calls[0]?.[1]).toEqual({
      activationRevision: 7,
      currentVersionId: "version-1",
      revision: 0,
      pageId: "slide-0",
      pageIndex: 0,
    });
  });

  it("unsubscribes and cancels the pending frame on cleanup", () => {
    const controller = controllerWith(0);
    const presentationState = presentation(["slide-0", "slide-1"]);

    const unsubscribe = vi.fn();
    mocks.onValue.mockReturnValue(unsubscribe);

    const cleanup = subscribeLiveSlideAck(
      {} as never,
      7,
      "version-1",
      presentationState,
      controller,
    );

    handler()(snapshot(command(7, 1, "slide-1")));

    cleanup();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.cancelAnimationFrame).toHaveBeenCalledOnce();
    expect(typeof errorHandler()).toBe("function");
  });
});
