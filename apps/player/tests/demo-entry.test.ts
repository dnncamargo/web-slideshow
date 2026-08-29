// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startDemo } from "../src/demo-entry";

describe("Player demo runtime", () => {
  let root: HTMLElement;
  let hidden = false;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>("#app")!;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("mounts the controls-free projection, advances, and cleans up", () => {
    const demo = startDemo(root);
    expect(root.querySelector(".powershow-player-controls")).toBeNull();
    expect(root.querySelector(".powershow-player-slide-surface")).not.toBeNull();

    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('[data-powershow-slide-id="slide-1"]')).toBeNull();

    demo.destroy();
    expect(root.children).toHaveLength(0);
  });

  it("pauses while hidden and resumes when visible", () => {
    const demo = startDemo(root);
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(20_000);
    expect(root.querySelector('[data-powershow-slide-id="slide-1"]')).not.toBeNull();

    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('[data-powershow-slide-id="slide-1"]')).toBeNull();
    demo.destroy();
  });

  it("does not autoplay when reduced motion is requested", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const demo = startDemo(root);
    vi.advanceTimersByTime(20_000);
    expect(root.querySelector('[data-powershow-slide-id="slide-1"]')).not.toBeNull();
    demo.destroy();
  });
});
