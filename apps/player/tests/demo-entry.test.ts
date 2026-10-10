// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startDemo } from "../src/demo-entry";

function pointerEvent(type: string, pointerType: string): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
}

describe("Player demo runtime", () => {
  let root: HTMLElement;
  let hidden = false;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
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
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("mounts the controls-free projection, advances, and cleans up", () => {
    const demo = startDemo(root);
    expect(root.querySelector(".player-controls")).toBeNull();
    expect(root.querySelector(".player-slide-surface")).not.toBeNull();

    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('[data-presentation-slide-id="slide-1"]')).toBeNull();

    demo.destroy();
    expect(root.children).toHaveLength(0);
  });

  it("pauses while hidden and resumes when visible", () => {
    const demo = startDemo(root);
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(20_000);
    expect(root.querySelector('[data-presentation-slide-id="slide-1"]')).not.toBeNull();

    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('[data-presentation-slide-id="slide-1"]')).toBeNull();
    demo.destroy();
  });

  it("advances through the authored Images and Plot slides", () => {
    const demo = startDemo(root);
    vi.advanceTimersByTime(70_000);
    expect(root.querySelector('[data-presentation-slide-id="slide-7"]')).not.toBeNull();
    expect(root.querySelector('[data-presentation-type="gallery"]')).toBeNull();

    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('[data-presentation-slide-id="slide-8"]')).not.toBeNull();
    demo.destroy();
  });

  it("pauses for touch Scripted input and resumes after the bounded recovery delay", () => {
    const demo = startDemo(root);
    vi.advanceTimersByTime(60_000);
    const scripted = root.querySelector<HTMLElement>('[data-presentation-type="scripted"]');
    expect(scripted).not.toBeNull();

    scripted?.dispatchEvent(pointerEvent("pointerdown", "touch"));
    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('[data-presentation-slide-id="slide"]')).not.toBeNull();

    vi.advanceTimersByTime(2_000);
    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('[data-presentation-slide-id="slide-7"]')).not.toBeNull();
    demo.destroy();
  });

  it("does not autoplay when reduced motion is requested", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const demo = startDemo(root);
    vi.advanceTimersByTime(20_000);
    expect(root.querySelector('[data-presentation-slide-id="slide-1"]')).not.toBeNull();
    demo.destroy();
  });

  it("pauses autoplay while the authored Scripted surface is being used", () => {
    const demo = startDemo(root);
    vi.advanceTimersByTime(60_000);
    const scripted = root.querySelector<HTMLElement>('[data-presentation-type="scripted"]');
    expect(scripted).not.toBeNull();

    scripted?.dispatchEvent(new Event("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(20_000);
    expect(root.querySelector('[data-presentation-slide-id="slide"]')).not.toBeNull();

    scripted?.dispatchEvent(new Event("pointerout", { bubbles: true }));
    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('[data-presentation-slide-id="slide-7"]')).not.toBeNull();
    demo.destroy();
  });
});
