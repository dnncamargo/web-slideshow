import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onValue: vi.fn(), ref: vi.fn() }));
vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref }));

import {
  SHAPE_ANIMATION_ACTION_ROOT_PATH,
  createLiveShapeAnimationActionTracker,
  parseLiveShapeAnimationActionRecord,
  parseShapeAnimationActionIndex,
  subscribeLiveShapeAnimationAction,
} from "../src/live-shape-animation-action";

const record = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 7,
  currentVersionId: "version-1",
  revision: 1,
  pageId: "page-1",
  elementId: "shape/[#]",
  targetBootId: "boot-a",
  action: "play",
  ...overrides,
});

describe("live Shape animation action", () => {
  it("parses the exact contract and canonical slot keys", () => {
    expect(SHAPE_ANIMATION_ACTION_ROOT_PATH).toBe("shapeAnimationAction");
    expect(parseShapeAnimationActionIndex("0")).toBe(0);
    expect(parseShapeAnimationActionIndex("2")).toBe(2);
    for (const key of ["-1", "01", "1.5", "shape"]) expect(parseShapeAnimationActionIndex(key)).toBeNull();
    expect(parseLiveShapeAnimationActionRecord(record({ elementId: "shape/[#]" }))).toMatchObject({ elementId: "shape/[#]" });
    expect(parseLiveShapeAnimationActionRecord({ ...record(), extra: true })).toBeNull();
    expect(parseLiveShapeAnimationActionRecord(record({ action: "restart" }))).toBeNull();
    expect(parseLiveShapeAnimationActionRecord(record({ revision: 0 }))).toBeNull();
    expect(parseLiveShapeAnimationActionRecord(record({ currentVersionId: " " }))).toBeNull();
  });

  it("tracks independent slots, rejects replay, and resets cursors for a boot", () => {
    const tracker = createLiveShapeAnimationActionTracker();
    tracker.prepareBoot("boot-a");
    expect(tracker.takeIfNew(0, record() as never)).toBe(true);
    expect(tracker.takeIfNew(0, record() as never)).toBe(false);
    expect(tracker.takeIfNew(0, record({ revision: 0 }) as never)).toBe(false);
    expect(tracker.takeIfNew(0, record({ revision: 3, action: "reset" }) as never)).toBe(true);
    expect(tracker.takeIfNew(0, record({ revision: 2 }) as never)).toBe(false);
    expect(tracker.takeIfNew(1, record() as never)).toBe(true);
    tracker.prepareBoot("boot-b");
    expect(tracker.takeIfNew(0, record({ targetBootId: "boot-b" }) as never)).toBe(true);
  });

  it("filters identity and page, then delegates play/pause/reset once", () => {
    let callback: ((snapshot: { val(): unknown }) => void) | undefined;
    mocks.ref.mockReturnValue({});
    mocks.onValue.mockImplementation((_ref: unknown, next: (snapshot: { val(): unknown }) => void) => { callback = next; return vi.fn(); });
    const controlShapeAnimation = vi.fn();
    let currentIndex = 0;
    const controller = { getCurrentIndex: () => currentIndex, controlShapeAnimation };
    const tracker = createLiveShapeAnimationActionTracker();
    const cleanup = subscribeLiveShapeAnimationAction({} as never, "owner-a", 7, "version-1", "boot-a", { slides: [{ id: "page-1" }, { id: "page-2" }] } as never, controller as never, tracker);
    expect(mocks.ref).toHaveBeenCalledWith({}, "live/owner-a/shapeAnimationAction");
    callback?.({ val: () => ({ 0: record(), 1: record({ elementId: "shape-2", action: "pause" }), "01": record() }) });
    expect(controlShapeAnimation).toHaveBeenCalledTimes(2);
    callback?.({ val: () => ({ 0: record({ revision: 1 }), 1: record({ revision: 1, elementId: "shape-2", action: "pause" }) }) });
    expect(controlShapeAnimation).toHaveBeenCalledTimes(2);
    callback?.({ val: () => ({ 0: record({ revision: 2, action: "reset", pageId: "page-2" }), 1: record({ revision: 2, activationRevision: 6 }) }) });
    expect(controlShapeAnimation).toHaveBeenCalledTimes(2);
    callback?.({ val: () => ({ 0: record({ revision: 2, action: "reset" }) }) });
    expect(controlShapeAnimation).toHaveBeenNthCalledWith(3, "shape/[#]", "reset");
    cleanup();
  });
});
