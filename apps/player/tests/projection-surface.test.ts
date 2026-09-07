// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
import { paletteColorCssVariableName } from "@powershow/renderer";

import { mountProjectionSurface } from "../src/projection-surface";

import { playerTestPresentation } from "./fixtures/player-presentation";

// ============================================================
// STUB DE HTMLElement.prototype.animate
//
// Instalado antes do mount quando o teste precisa observar o
// comportamento do render inicial, e restaurado no afterEach
// para não vazar mutação de protótipo para os demais testes.
// ============================================================

const ORIGINAL_ANIMATE = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "animate",
);
const ORIGINAL_MATCH_MEDIA = Object.getOwnPropertyDescriptor(window, "matchMedia");

let restoreAnimate: (() => void) | undefined;

function stubAnimate(): ReturnType<typeof vi.fn> {
  const animate = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  restoreAnimate = () => {
    if (ORIGINAL_ANIMATE) {
      Object.defineProperty(HTMLElement.prototype, "animate", ORIGINAL_ANIMATE);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  };
  return animate;
}

function animatedPresentation() {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "animated-presentation",
    title: "Animated presentation",
    slides: [{
      id: "animated-slide",
      elements: [{
        id: "animated-plot",
        type: "plot",
        hidden: false,
        source: "y = x + t",
        animation: { parameter: "t", from: 0, to: 10, durationMs: 1000, loop: false },
      }],
    }],
  });
}

function stubPlotRaf(): {
  callbacks: Map<number, FrameRequestCallback>;
  request: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  run(timestamp: number): void;
} {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  const cancel = vi.fn((id: number) => {
    callbacks.delete(id);
  });
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);

  return {
    callbacks,
    request,
    cancel,
    run(timestamp: number): void {
      const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (next === undefined) throw new Error("No scheduled Plot frame");
      callbacks.delete(next[0]);
      next[1](timestamp);
    },
  };
}

describe("Projection surface", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `<div id="app"></div>`;
    const element = document.querySelector<HTMLElement>("#app");

    if (!element) {
      throw new Error("Test root was not created.");
    }

    root = element;
  });

  afterEach(() => {
    restoreAnimate?.();
    restoreAnimate = undefined;
    vi.unstubAllGlobals();
    if (ORIGINAL_MATCH_MEDIA) {
      Object.defineProperty(window, "matchMedia", ORIGINAL_MATCH_MEDIA);
    } else {
      Reflect.deleteProperty(window, "matchMedia");
    }
    document.body.replaceChildren();
  });

  it("animates Plot playback by default without leaking source", () => {
    const raf = stubPlotRaf();
    const projection = mountProjectionSurface(root, animatedPresentation(), { transition: "none" });
    const plot = root.querySelector<HTMLElement>('[data-powershow-id="animated-plot"]');
    if (!plot) throw new Error("Animated Plot was not rendered");

    raf.run(100);
    const initial = plot.innerHTML;
    raf.run(600);

    expect(raf.request).toHaveBeenCalledTimes(3);
    expect(plot.innerHTML).not.toBe(initial);
    expect(root.innerHTML).not.toContain("y = x + t");
    projection.destroy();
  });

  it("supports explicit Plot animation opt-out", () => {
    const raf = stubPlotRaf();
    const projection = mountProjectionSurface(root, animatedPresentation(), {
      transition: "none",
      animatePlots: false,
    });
    const plot = root.querySelector<HTMLElement>('[data-powershow-id="animated-plot"]');

    expect(raf.request).not.toHaveBeenCalled();
    expect(plot).not.toBeNull();
    expect(root.innerHTML).not.toContain("y = x + t");
    projection.destroy();
  });

  it("suppresses Plot playback when reduced motion is requested", () => {
    const raf = stubPlotRaf();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const projection = mountProjectionSurface(root, animatedPresentation(), { transition: "none" });

    expect(raf.request).not.toHaveBeenCalled();
    expect(() => projection.controlPlotAnimation("animated-plot", "play")).not.toThrow();
    projection.destroy();
  });

  it("delegates Plot play, pause, and reset through the active renderer runtime", () => {
    const raf = stubPlotRaf();
    const projection = mountProjectionSurface(root, animatedPresentation(), { transition: "none" });
    const plot = root.querySelector<HTMLElement>('[data-powershow-id="animated-plot"]');
    if (!plot) throw new Error("Animated Plot was not rendered");

    projection.controlPlotAnimation("animated-plot", "pause");
    expect(raf.callbacks.size).toBe(0);
    projection.controlPlotAnimation("animated-plot", "play");
    expect(raf.callbacks.size).toBe(1);
    projection.controlPlotAnimation("animated-plot", "toggle");
    expect(raf.callbacks.size).toBe(0);
    projection.controlPlotAnimation("animated-plot", "toggle");
    expect(raf.callbacks.size).toBe(1);
    projection.controlPlotAnimation("animated-plot", "reset");
    expect(raf.callbacks.size).toBe(0);
    expect(() => projection.controlPlotAnimation("missing", "play")).not.toThrow();
    projection.destroy();
  });

  it("does not control static Plots", () => {
    const raf = stubPlotRaf();
    const presentation = PresentationSchema.parse({
      schemaVersion: 1, id: "static-plot", title: "Static", description: "", aspectRatio: "16:9",
      slides: [{ id: "slide", elements: [{ id: "static-plot", type: "plot", hidden: false, source: "y = x" }] }],
    });
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    expect(() => projection.controlPlotAnimation("static-plot", "play")).not.toThrow();
    expect(raf.request).not.toHaveBeenCalled();
    projection.destroy();
  });

  it("retains the Plot runtime across resize hydration", () => {
    const raf = stubPlotRaf();
    const projection = mountProjectionSurface(root, animatedPresentation(), { transition: "none" });
    const plot = root.querySelector<HTMLElement>('[data-powershow-id="animated-plot"]');
    if (!plot) throw new Error("Animated Plot was not rendered");

    const initial = plot.innerHTML;
    raf.run(100);
    window.dispatchEvent(new Event("resize"));
    raf.run(600);

    expect(raf.request).toHaveBeenCalledTimes(3);
    expect(plot.innerHTML).not.toBe(initial);
    projection.destroy();
  });

  it("disposes the old Plot runtime before changing slides", () => {
    const raf = stubPlotRaf();
    const presentation = PresentationSchema.parse({
      ...animatedPresentation(),
      id: "two-slides",
      slides: [
        animatedPresentation().slides[0]!,
        {
          id: "second-slide",
          elements: [{
            id: "second-plot",
            type: "plot",
            hidden: false,
            source: "y = x + phase",
            animation: { parameter: "phase", from: 5, to: 6, durationMs: 1000, loop: false },
          }],
        },
      ],
    });
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    const firstPlot = root.querySelector<HTMLElement>('[data-powershow-id="animated-plot"]');
    if (!firstPlot) throw new Error("First Plot was not rendered");
    const firstFrameId = Array.from(raf.callbacks.keys())[0];

    projection.goTo(1);
    expect(firstFrameId).toBeDefined();
    expect(raf.cancel).toHaveBeenCalledWith(firstFrameId);
    expect(root.querySelector('[data-powershow-id="animated-plot"]')).toBeNull();
    expect(root.querySelector('[data-powershow-id="second-plot"]')).not.toBeNull();
    expect(raf.callbacks.size).toBe(1);
    projection.destroy();
  });

  it("disposes Plot playback when destroyed", () => {
    const raf = stubPlotRaf();
    const projection = mountProjectionSurface(root, animatedPresentation(), { transition: "none" });
    const plot = root.querySelector<HTMLElement>('[data-powershow-id="animated-plot"]');
    if (!plot) throw new Error("Animated Plot was not rendered");
    const beforeDestroy = plot.innerHTML;
    const pending = Array.from(raf.callbacks.values())[0];

    projection.destroy();
    projection.destroy();
    pending?.(600);

    expect(raf.cancel).toHaveBeenCalledTimes(1);
    expect(plot.innerHTML).toBe(beforeDestroy);
  });

  it("renders the first slide without Player controls", () => {
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "none",
    });

    expect(root.querySelector(".powershow-player-slide-surface")).not.toBeNull();
    expect(root.querySelector(".powershow-player-controls")).toBeNull();
    expect(root.innerHTML).toContain("Slide One");
    expect(projection.getCurrentIndex()).toBe(0);

    projection.destroy();
  });

  it("renders the representative Blocks composition through the Player projection", () => {
    const presentation = PresentationSchema.parse({
      ...playerTestPresentation,
      id: "blocks-projection",
      slides: [{
        id: "blocks-slide",
        elements: [{
          type: "blocks",
          id: "projection-blocks",
          hidden: false,
          source: String.raw`\start(When flag clicked)
\statement(Move \value(10) steps)
\end(Stop all)`,
        }],
      }],
    });
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    const blocksRoot = root.querySelector<HTMLElement>('[data-powershow-type="blocks"]');
    if (!blocksRoot) throw new Error("Player Blocks projection was not rendered");
    expect(blocksRoot.querySelector(".powershow-block--start")).not.toBeNull();
    expect(blocksRoot.textContent).toContain("When flag clicked");
    expect(blocksRoot.textContent).toContain("Move 10 steps");
    expect(blocksRoot.querySelector(".powershow-block--end")).not.toBeNull();
    expect(blocksRoot.querySelectorAll("[onclick]")).toHaveLength(0);

    projection.destroy();
  });

  it("navigates to valid indexes and fails closed for invalid indexes", () => {
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "none",
    });

    projection.goTo(1);
    expect(projection.getCurrentIndex()).toBe(1);
    expect(root.innerHTML).toContain("Slide Two");

    projection.goTo(-1);
    projection.goTo(3);
    projection.goTo(1.5);
    projection.goTo(Number.NaN);

    expect(projection.getCurrentIndex()).toBe(1);
    expect(root.innerHTML).toContain("Slide Two");

    projection.destroy();
  });

  it("changes only subsequent slide animations when the transition changes", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation);
    const initialCalls = animate.mock.calls.length;
    projection.setTransition("none");
    projection.goTo(1);
    expect(animate).toHaveBeenCalledTimes(initialCalls);
    projection.setTransition("fade");
    projection.goTo(0);
    expect(animate.mock.calls.length).toBe(initialCalls + 1);
    projection.destroy();
  });

  // ============================================================
  // BEGIN: TRANSIÇÕES DE SLIDE
  // ============================================================

  it("supports slide as a transition and does not animate the initial mount", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "slide",
    });

    expect(projection.getCurrentIndex()).toBe(0);
    expect(animate).not.toHaveBeenCalled();

    projection.destroy();
  });

  it("slides in from the right on forward navigation", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "slide",
    });

    projection.goTo(1);

    expect(animate).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledWith(
      [
        { opacity: 0, transform: "translateX(2%)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 180, easing: "ease-out" },
    );

    projection.destroy();
  });

  it("slides in from the left on backward navigation", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "slide",
    });

    projection.goTo(1);
    expect(animate).toHaveBeenCalledOnce();

    projection.goTo(0);

    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenLastCalledWith(
      [
        { opacity: 0, transform: "translateX(-2%)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 180, easing: "ease-out" },
    );

    projection.destroy();
  });

  it("keeps the existing scale+opacity fade path", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "fade",
    });

    projection.goTo(1);

    expect(animate).toHaveBeenCalledWith(
      [
        { opacity: 0, transform: "scale(0.995)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 180, easing: "ease-out" },
    );

    projection.destroy();
  });

  it("does not animate slide changes when transition is none", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "none",
    });

    projection.goTo(1);

    expect(animate).not.toHaveBeenCalled();
    expect(projection.getCurrentIndex()).toBe(1);

    projection.destroy();
  });

  it("applies slide to subsequent navigation without changing the current index", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "none",
    });

    projection.setTransition("slide");
    expect(projection.getCurrentIndex()).toBe(0);
    expect(animate).not.toHaveBeenCalled();

    projection.goTo(1);

    expect(animate).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledWith(
      [
        { opacity: 0, transform: "translateX(2%)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 180, easing: "ease-out" },
    );

    projection.destroy();
  });

  it("restores the fade animation after setTransition to fade", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "slide",
    });

    projection.goTo(1);
    expect(animate).toHaveBeenCalledOnce();

    projection.setTransition("fade");
    projection.goTo(0);

    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenLastCalledWith(
      [
        { opacity: 0, transform: "scale(0.995)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 180, easing: "ease-out" },
    );

    projection.destroy();
  });

  it("does not move or animate when only the transition changes", () => {
    const animate = stubAnimate();
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "fade",
    });
    const initialCalls = animate.mock.calls.length;

    projection.setTransition("slide");
    projection.setTransition("none");
    projection.setTransition("fade");

    expect(projection.getCurrentIndex()).toBe(0);
    expect(animate.mock.calls.length).toBe(initialCalls);

    projection.destroy();
  });

  // ============================================================
  // END: TRANSIÇÕES DE SLIDE
  // ============================================================

  it("keeps fonts, palette, geometry, and runtime hydration on the seam", () => {
    const presentation = PresentationSchema.parse({
      ...playerTestPresentation,
      aspectRatio: "4:3",
      palette: {
        colors: [{ id: "accent", name: "Accent", value: "#f0c000" }],
      },
      resources: {
        fonts: [
          {
            id: "inter",
            family: "Inter",
            source: {
              type: "url",
              url: "https://cdn.example.com/inter.woff2",
              format: "woff2",
            },
          },
        ],
      },
      slides: [
        {
          id: "runtime-slide",
          elements: [
            {
              type: "container",
              id: "fit-container",
              layout: {
                children: {
                  fit: { mode: "contain", sourceWidth: 800, sourceHeight: 400 },
                },
              },
              children: [
                {
                  type: "text",
                  id: "runtime-text",
                  content: "Runtime hydration",
                  style: { color: { kind: "palette", colorId: "accent" } },
                },
              ],
            },
          ],
        },
      ],
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });

    const projection = mountProjectionSurface(root, presentation, {
      transition: "none",
    });
    const surface = root.querySelector<HTMLElement>(
      ".powershow-player-slide-surface",
    );
    const fitSurface = root.querySelector<HTMLElement>(
      ".powershow-container-fit-surface",
    );
    const fitViewport = root.querySelector<HTMLElement>(
      "[data-powershow-container-fit]",
    );

    expect(root.querySelector("style[data-powershow-font-resources]")).not.toBeNull();
    expect(root.querySelector("style[data-powershow-font-resources]")?.textContent).toContain(
      "@font-face",
    );
    expect(surface?.style.getPropertyValue(paletteColorCssVariableName("accent"))).toBe(
      "#f0c000",
    );
    expect(surface?.style.width).toBe("960px");
    expect(surface?.style.height).toBe("720px");
    expect(surface?.style.transform).toBe("scale(1.25)");
    expect(fitSurface).not.toBeNull();
    expect(fitViewport).not.toBeNull();

    Object.defineProperty(fitViewport, "clientWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(fitViewport, "clientHeight", {
      configurable: true,
      value: 400,
    });
    window.dispatchEvent(new Event("resize"));

    expect(fitSurface?.style.transform).toBe(
      "translate(0px,0px) scale(1,1)",
    );
    expect(root.innerHTML).toContain("Runtime hydration");

    projection.destroy();
  });

  it("cleans up safely and idempotently", () => {
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "none",
    });

    projection.destroy();
    projection.destroy();

    expect(root.children).toHaveLength(0);
    expect(() => window.dispatchEvent(new Event("resize"))).not.toThrow();
  });
});
