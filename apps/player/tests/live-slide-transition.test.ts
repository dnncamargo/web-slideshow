import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/database", () => ({ onValue: vi.fn(), ref: vi.fn() }));

import { onValue, ref } from "firebase/database";
import {
  parseLiveSlideTransition,
  resolveLiveSlideTransition,
  subscribeLiveSlideTransition,
} from "../src/live-slide-transition";

describe("live slide transition", () => {
  it("parses exactly fade", () => {
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "fade" })).toEqual({ activationRevision: 7, transition: "fade" });
  });
  it("parses exactly slide", () => {
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "slide" })).toEqual({ activationRevision: 7, transition: "slide" });
  });
  it("parses exactly none", () => {
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "none" })).toEqual({ activationRevision: 7, transition: "none" });
  });
  it("rejects invalid transition values", () => {
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "zoom" })).toBeNull();
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "fade-in" })).toBeNull();
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: 1 })).toBeNull();
  });
  it("rejects extra fields", () => {
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "fade", pageId: "x" })).toBeNull();
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "fade", revision: 1 })).toBeNull();
  });
  it("defaults missing values to fade", () => {
    expect(resolveLiveSlideTransition(null, 7)).toBe("fade");
  });
  it("defaults malformed values to fade", () => {
    expect(resolveLiveSlideTransition({ transition: "none" }, 7)).toBe("fade");
    expect(resolveLiveSlideTransition({ activationRevision: 7, transition: "zoom" }, 7)).toBe("fade");
  });
  it("defaults stale activation to fade", () => {
    expect(resolveLiveSlideTransition({ activationRevision: 6, transition: "none" }, 7)).toBe("fade");
    expect(resolveLiveSlideTransition({ activationRevision: 8, transition: "slide" }, 7)).toBe("fade");
  });
  it("applies the matching activation fade", () => {
    expect(resolveLiveSlideTransition({ activationRevision: 7, transition: "fade" }, 7)).toBe("fade");
  });
  it("applies the matching activation slide", () => {
    expect(resolveLiveSlideTransition({ activationRevision: 7, transition: "slide" }, 7)).toBe("slide");
  });
  it("applies the matching activation none", () => {
    expect(resolveLiveSlideTransition({ activationRevision: 7, transition: "none" }, 7)).toBe("none");
  });
  it("subscribes, applies matching snapshots, and cleans up", () => {
    const setTransition = vi.fn();
    const unsubscribe = vi.fn();
    let callback: ((snapshot: { val(): unknown }) => void) | undefined;
    vi.mocked(ref).mockReturnValue({} as ReturnType<typeof ref>);
    vi.mocked(onValue).mockImplementation((_reference, next) => {
      callback = next as unknown as (snapshot: { val(): unknown }) => void;
      return unsubscribe;
    });
    const cleanup = subscribeLiveSlideTransition({} as never, 7, { setTransition });
    callback?.({ val: () => ({ activationRevision: 7, transition: "slide" }) });
    callback?.({ val: () => ({ activationRevision: 7, transition: "none" }) });
    callback?.({ val: () => ({ activationRevision: 6, transition: "slide" }) });
    callback?.({ val: () => ({ activationRevision: 7, transition: "fade" }) });
    expect(setTransition).toHaveBeenNthCalledWith(1, "slide");
    expect(setTransition).toHaveBeenNthCalledWith(2, "none");
    expect(setTransition).toHaveBeenNthCalledWith(3, "fade");
    expect(setTransition).toHaveBeenNthCalledWith(4, "fade");
    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});