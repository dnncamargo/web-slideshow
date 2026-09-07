import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onValue: vi.fn(), ref: vi.fn() }));
vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref }));

import {
  PLOT_ANIMATION_ACTION_ROOT_PATH,
  parseLivePlotAnimationActionRecord,
  parsePlotAnimationActionIndex,
  createLivePlotAnimationActionTracker,
  subscribeLivePlotAnimationAction,
} from "../src/live-plot-animation-action";

const record = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 7,
  currentVersionId: "version-1",
  revision: 1,
  pageId: "page-1",
  elementId: "plot/[#]",
  targetBootId: "boot-a",
  action: "play",
  ...overrides,
});

describe("live Plot animation action parser", () => {
  it("uses the exact root and accepts all V1 actions", () => {
    expect(PLOT_ANIMATION_ACTION_ROOT_PATH).toBe("live/plotAnimationAction");
    for (const action of ["play", "pause", "reset", "toggle"] as const) {
      expect(parseLivePlotAnimationActionRecord(record({ action }))?.action).toBe(action);
    }
  });

  it("rejects malformed records and preserves canonical ids", () => {
    expect(parseLivePlotAnimationActionRecord(record())).toMatchObject({ elementId: "plot/[#]" });
    expect(parseLivePlotAnimationActionRecord(record({ action: "restart" }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ revision: 0 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ revision: 1.5 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord({ ...record(), extra: true })).toBeNull();
    expect(parseLivePlotAnimationActionRecord({ ...record(), pageId: " " })).toBeNull();
    expect(parseLivePlotAnimationActionRecord({ ...record(), elementId: "" })).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ activationRevision: -1 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ activationRevision: 1.5 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ currentVersionId: " " }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ targetBootId: " " }))).toBeNull();
    const fields = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "targetBootId", "action"] as const;
    for (const field of fields) {
      const missing = { ...record() };
      delete missing[field];
      expect(parseLivePlotAnimationActionRecord(missing)).toBeNull();
    }
  });

  it("accepts only canonical non-negative decimal slot keys", () => {
    expect(parsePlotAnimationActionIndex("0")).toBe(0);
    expect(parsePlotAnimationActionIndex("42")).toBe(42);
    for (const key of ["01", "-1", "1.5", "", "plot"]) expect(parsePlotAnimationActionIndex(key)).toBeNull();
  });
});

describe("live Plot animation action tracker and subscriber", () => {
  it("keeps high-water cursors per slot and resets only for a new boot", () => {
    const tracker = createLivePlotAnimationActionTracker();
    const first = record({ revision: 1 });
    tracker.prepareBoot("boot-a");
    expect(tracker.takeIfNew(0, first as never)).toBe(true);
    expect(tracker.takeIfNew(0, first as never)).toBe(false);
    expect(tracker.takeIfNew(0, record({ revision: 0 }) as never)).toBe(false);
    expect(tracker.takeIfNew(0, record({ revision: 3, action: "reset" }) as never)).toBe(true);
    expect(tracker.takeIfNew(0, record({ revision: 2 }) as never)).toBe(false);
    expect(tracker.takeIfNew(1, record({ revision: 1 }) as never)).toBe(true);
    expect(tracker.prepareBoot("boot-a")).toBeUndefined();
    expect(tracker.takeIfNew(0, record({ revision: 3 }) as never)).toBe(false);
    tracker.prepareBoot("boot-b");
    expect(tracker.takeIfNew(0, record({ revision: 1, targetBootId: "boot-b" }) as never)).toBe(true);
  });

  it("accepts each Plot identity change as a new slot stream", () => {
    const tracker = createLivePlotAnimationActionTracker();
    tracker.prepareBoot("boot-a");
    expect(tracker.takeIfNew(0, record({ revision: 5 }) as never)).toBe(true);
    for (const change of [
      { activationRevision: 8 },
      { currentVersionId: "version-2" },
      { pageId: "page-2" },
      { elementId: "plot-2" },
      { targetBootId: "boot-b" },
    ]) {
      expect(tracker.takeIfNew(0, record({ revision: 1, ...change }) as never)).toBe(true);
    }
  });

  it("keeps equal and lower revisions closed, accepts higher revisions once, and tolerates gaps", () => {
    const tracker = createLivePlotAnimationActionTracker();
    tracker.prepareBoot("boot-a");
    expect(tracker.takeIfNew(0, record({ revision: 1 }) as never)).toBe(true);
    expect(tracker.takeIfNew(0, record({ revision: 1 }) as never)).toBe(false);
    expect(tracker.takeIfNew(0, record({ revision: 0 }) as never)).toBe(false);
    expect(tracker.takeIfNew(0, record({ revision: 3, action: "reset" }) as never)).toBe(true);
    expect(tracker.takeIfNew(0, record({ revision: 3, action: "reset" }) as never)).toBe(false);
  });

  it("subscribes to the exact root, consumes before page validation, and delegates once", () => {
    let callback: ((snapshot: { val(): unknown }) => void) | undefined;
    mocks.ref.mockReturnValue({});
    mocks.onValue.mockImplementation((_ref: unknown, next: (snapshot: { val(): unknown }) => void) => {
      callback = next;
      return vi.fn();
    });
    const controlPlotAnimation = vi.fn();
    let currentIndex = 1;
    const presentation = { slides: [{ id: "page-a" }, { id: "page-b" }] };
    const controller = { getCurrentIndex: () => currentIndex, controlPlotAnimation };
    const tracker = createLivePlotAnimationActionTracker();
    const cleanup = subscribeLivePlotAnimationAction({} as never, 7, "version-1", "boot-a", presentation as never, controller as never, tracker);
    expect(mocks.ref).toHaveBeenCalledWith({}, "live/plotAnimationAction");
    callback?.({ val: () => ({ bad: record(), "01": record(), 0: record({ pageId: "page-a" }) }) });
    expect(controlPlotAnimation).not.toHaveBeenCalled();
    currentIndex = 0;
    callback?.({ val: () => ({ 0: record({ pageId: "page-a" }) }) });
    expect(controlPlotAnimation).not.toHaveBeenCalled();
    callback?.({ val: () => ({
      0: record({ revision: 2, pageId: "page-a", action: "pause" }),
      1: record({ elementId: "plot-2", targetBootId: "old-boot", action: "reset" }),
    }) });
    expect(controlPlotAnimation).toHaveBeenCalledExactlyOnceWith("plot/[#]", "pause");
    callback?.({ val: () => ({ 0: record({ revision: 3, pageId: "page-a", action: "reset" }) }) });
    expect(controlPlotAnimation).toHaveBeenNthCalledWith(2, "plot/[#]", "reset");
    callback?.({ val: () => ({ 0: record({ revision: 4, pageId: "page-a", action: "toggle" }) }) });
    expect(controlPlotAnimation).toHaveBeenNthCalledWith(3, "plot/[#]", "toggle");
    callback?.({ val: () => ({ 0: record({ revision: 4, activationRevision: 6 }) }) });
    callback?.({ val: () => ({ 0: record({ revision: 5, currentVersionId: "old-version" }) }) });
    callback?.({ val: () => ({ 0: record({ revision: 6, targetBootId: "old-boot" }) }) });
    expect(controlPlotAnimation).toHaveBeenCalledTimes(3);
    cleanup();
  });

  it("routes play, pause, and reset independently and preserves consumption across resubscribe", () => {
    const callbacks: Array<(snapshot: { val(): unknown }) => void> = [];
    mocks.ref.mockReturnValue({});
    mocks.onValue.mockImplementation((_ref: unknown, next: (snapshot: { val(): unknown }) => void) => {
      callbacks.push(next);
      return vi.fn();
    });
    const controlPlotAnimation = vi.fn();
    const presentation = { slides: [{ id: "page-1" }] };
    const controller = { getCurrentIndex: () => 0, controlPlotAnimation };
    const tracker = createLivePlotAnimationActionTracker();
    const first = subscribeLivePlotAnimationAction({} as never, 7, "version-1", "boot-a", presentation as never, controller as never, tracker);
    callbacks[0]?.({ val: () => ({ 0: record({ action: "play" }) }) });
    first();
    const second = subscribeLivePlotAnimationAction({} as never, 7, "version-1", "boot-a", presentation as never, controller as never, tracker);
    callbacks[1]?.({ val: () => ({ 0: record({ action: "play" }) }) });
    callbacks[1]?.({ val: () => ({ 0: record({ revision: 2, action: "pause" }), 1: record({ elementId: "plot-2", action: "reset" }) }) });
    expect(controlPlotAnimation).toHaveBeenNthCalledWith(1, "plot/[#]", "play");
    expect(controlPlotAnimation).toHaveBeenNthCalledWith(2, "plot/[#]", "pause");
    expect(controlPlotAnimation).toHaveBeenNthCalledWith(3, "plot-2", "reset");
    expect(controlPlotAnimation).toHaveBeenCalledTimes(3);
    second();
  });
});
