import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/database", () => ({ onValue: vi.fn(), ref: vi.fn() }));

import { onValue, ref } from "firebase/database";
import {
  parseLivePlayerControls,
  resolveLivePlayerControls,
  subscribeLivePlayerControls,
} from "../src/live-player-controls";

const FALLBACK = {
  position: "bottom-right",
  style: "compact",
  showCounter: true,
  animation: "fade",
} as const;

const FULL_RECORD = {
  activationRevision: 7,
  position: "bottom-right",
  style: "compact",
  showCounter: true,
  animation: "fade",
} as const;

describe("live player controls", () => {
  it("parses an exact baseline-shaped record", () => {
    expect(parseLivePlayerControls(FULL_RECORD)).toEqual(FULL_RECORD);
  });

  it("accepts every position value", () => {
    for (const position of ["bottom-center", "bottom-left", "bottom-right", "top-center", "top-left", "top-right"] as const) {
      expect(parseLivePlayerControls({ ...FULL_RECORD, position })).toEqual({ ...FULL_RECORD, position });
    }
  });

  it("accepts every style value", () => {
    for (const style of ["floating", "minimal", "compact"] as const) {
      expect(parseLivePlayerControls({ ...FULL_RECORD, style })).toEqual({ ...FULL_RECORD, style });
    }
  });

  it("accepts every animation value", () => {
    for (const animation of ["fade", "slide", "none"] as const) {
      expect(parseLivePlayerControls({ ...FULL_RECORD, animation })).toEqual({ ...FULL_RECORD, animation });
    }
  });

  it("requires showCounter to be a boolean", () => {
    expect(parseLivePlayerControls({ ...FULL_RECORD, showCounter: 1 })).toBeNull();
    expect(parseLivePlayerControls({ ...FULL_RECORD, showCounter: "true" })).toBeNull();
    expect(parseLivePlayerControls({ ...FULL_RECORD, showCounter: null })).toBeNull();
  });

  it("rejects extra keys", () => {
    expect(parseLivePlayerControls({ ...FULL_RECORD, pageId: "x" })).toBeNull();
    expect(parseLivePlayerControls({ ...FULL_RECORD, revision: 1 })).toBeNull();
  });

  it("rejects missing keys", () => {
    const { style: _style, ...missingStyle } = FULL_RECORD;
    expect(parseLivePlayerControls(missingStyle)).toBeNull();
  });

  it("rejects invalid position, style, and animation values", () => {
    expect(parseLivePlayerControls({ ...FULL_RECORD, position: "middle" })).toBeNull();
    expect(parseLivePlayerControls({ ...FULL_RECORD, style: "large" })).toBeNull();
    expect(parseLivePlayerControls({ ...FULL_RECORD, animation: "bounce" })).toBeNull();
  });

  it("applies the matching current activation exact controls", () => {
    const record = { activationRevision: 7, position: "top-left", style: "minimal", showCounter: false, animation: "slide" };
    expect(resolveLivePlayerControls(record, 7, FALLBACK)).toEqual({
      position: "top-left",
      style: "minimal",
      showCounter: false,
      animation: "slide",
    });
  });

  it("falls back to the Live baseline when missing", () => {
    expect(resolveLivePlayerControls(null, 7, FALLBACK)).toEqual(FALLBACK);
  });

  it("falls back to the Live baseline when malformed", () => {
    expect(resolveLivePlayerControls({ position: "top-left" }, 7, FALLBACK)).toEqual(FALLBACK);
    expect(resolveLivePlayerControls({ ...FULL_RECORD, style: "large" }, 7, FALLBACK)).toEqual(FALLBACK);
  });

  it("falls back to the Live baseline for a stale activation", () => {
    expect(resolveLivePlayerControls({ ...FULL_RECORD, activationRevision: 6 }, 7, FALLBACK)).toEqual(FALLBACK);
  });

  it("subscribes, applies matching snapshots and baseline fallbacks, and cleans up", () => {
    const setControlsOptions = vi.fn();
    const unsubscribe = vi.fn();
    let callback: ((snapshot: { val(): unknown }) => void) | undefined;
    vi.mocked(ref).mockReturnValue({} as ReturnType<typeof ref>);
    vi.mocked(onValue).mockImplementation((_reference, next) => {
      callback = next as unknown as (snapshot: { val(): unknown }) => void;
      return unsubscribe;
    });
    const cleanup = subscribeLivePlayerControls({} as never, 7, { setControlsOptions }, FALLBACK);
    callback?.({ val: () => ({ activationRevision: 7, position: "top-left", style: "minimal", showCounter: false, animation: "slide" }) });
    callback?.({ val: () => null });
    callback?.({ val: () => ({ ...FULL_RECORD, activationRevision: 6 }) });
    expect(setControlsOptions).toHaveBeenNthCalledWith(1, { position: "top-left", style: "minimal", showCounter: false, animation: "slide" });
    expect(setControlsOptions).toHaveBeenNthCalledWith(2, FALLBACK);
    expect(setControlsOptions).toHaveBeenNthCalledWith(3, FALLBACK);
    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});