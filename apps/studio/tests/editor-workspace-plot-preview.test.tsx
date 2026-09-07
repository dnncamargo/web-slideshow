// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "plot-preview-workspace",
    title: "Plot preview workspace",
    aspectRatio: "16:9",
    slides: [{
      id: "slide-1",
      title: "Plot",
      elements: [{
        type: "plot",
        id: "plot-1",
        hidden: false,
        source: "y = x + t",
        animation: {
          parameter: "t",
          from: 0,
          to: 10,
          durationMs: 1000,
          loop: false,
        },
      }],
    }],
  });
}

let callbacks: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let requestFrame: ReturnType<typeof vi.fn>;
let cancelFrame: ReturnType<typeof vi.fn>;

function runNextFrame(timestamp: number): void {
  const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (next === undefined) throw new Error("No scheduled frame");
  callbacks.delete(next[0]);
  next[1](timestamp);
}

describe("EditorWorkspace Plot preview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    callbacks = new Map();
    nextFrameId = 1;
    requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      callbacks.set(id, callback);
      return id;
    });
    cancelFrame = vi.fn((id: number) => callbacks.delete(id));
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  async function mount(): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });
  }

  async function selectPlot(): Promise<void> {
    const plot = container.querySelector<HTMLElement>('[data-powershow-id="plot-1"]');
    if (!plot) throw new Error("Plot was not rendered");
    await act(async () => plot.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function previewButton(id: string): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(`#${id}`);
    if (!button) throw new Error(`Preview button not found: ${id}`);
    return button;
  }

  function animationInput(id: string): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Animation input not found: ${id}`);
    return input;
  }

  it("registers the Canvas statically and previews through Inspector commands", async () => {
    await mount();

    const plot = container.querySelector<HTMLElement>('[data-powershow-id="plot-1"]');
    if (!plot) throw new Error("Plot was not rendered");
    expect(requestFrame).not.toHaveBeenCalled();
    expect(plot.innerHTML).not.toContain("y = x + t");

    await selectPlot();
    await act(async () => previewButton("plot-animation-preview-play").click());
    expect(requestFrame).toHaveBeenCalledTimes(1);

    runNextFrame(100);
    const initialFrame = plot.innerHTML;
    runNextFrame(600);
    expect(plot.innerHTML).not.toBe(initialFrame);
    expect(plot.innerHTML).not.toContain("y = x + t");

    await act(async () => previewButton("plot-animation-preview-pause").click());
    const pausedFrame = plot.innerHTML;
    expect(callbacks.size).toBe(0);

    await act(async () => previewButton("plot-animation-preview-play").click());
    runNextFrame(2000);
    expect(plot.innerHTML).toBe(pausedFrame);
    runNextFrame(2500);
    expect(plot.innerHTML).not.toBe(pausedFrame);

    await act(async () => previewButton("plot-animation-preview-reset").click());
    expect(plot.innerHTML).toBe(initialFrame);
  });

  it("disposes active preview work when the EditorWorkspace unmounts", async () => {
    await mount();
    await selectPlot();
    await act(async () => previewButton("plot-animation-preview-play").click());
    expect(requestFrame).toHaveBeenCalledTimes(1);

    const plot = container.querySelector<HTMLElement>('[data-powershow-id="plot-1"]');
    if (!plot) throw new Error("Plot was not rendered");
    await act(async () => root.unmount());

    expect(cancelFrame).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    expect(() => runNextFrame(500)).toThrow("No scheduled frame");
    expect(plot.innerHTML).not.toContain("y = x + t");
  });

  it("rehydrates a changed duration even when static Plot HTML is unchanged", async () => {
    await mount();
    await selectPlot();
    const plotBeforeApply = container.querySelector<HTMLElement>('[data-powershow-id="plot-1"]');
    if (!plotBeforeApply) throw new Error("Plot was not rendered");

    const duration = animationInput("plot-animation-duration");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(duration, "2000");
    await act(async () => duration.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => container.querySelector<HTMLButtonElement>("#plot-animation-apply")?.click());

    const plotAfterApply = container.querySelector<HTMLElement>('[data-powershow-id="plot-1"]');
    expect(plotAfterApply).not.toBeNull();
    expect(plotAfterApply?.innerHTML).toBe(plotBeforeApply.innerHTML);
    expect(requestFrame).not.toHaveBeenCalled();

    await act(async () => previewButton("plot-animation-preview-play").click());
    runNextFrame(100);
    runNextFrame(1100);
    expect(callbacks.size).toBe(1);
    runNextFrame(2100);
    expect(callbacks.size).toBe(0);
  });

  it("preserves active Plot preview across Canvas resize rehydration", async () => {
    await mount();
    await selectPlot();
    await act(async () => previewButton("plot-animation-preview-play").click());
    expect(requestFrame).toHaveBeenCalledTimes(1);

    const plotBeforeResize = container.querySelector<HTMLElement>('[data-powershow-id="plot-1"]');
    const viewport = container.querySelector<HTMLElement>("[class*='canvasViewport']");
    if (!plotBeforeResize || !viewport) throw new Error("Plot viewport was not rendered");
    const fromFrame = plotBeforeResize.innerHTML;

    runNextFrame(100);
    runNextFrame(500);
    const beforeResize = plotBeforeResize.innerHTML;
    const requestCountBeforeResize = requestFrame.mock.calls.length;
    const cancelCountBeforeResize = cancelFrame.mock.calls.length;
    expect(beforeResize).not.toBe(fromFrame);
    expect(beforeResize).not.toContain("y = x + t");
    expect(callbacks.size).toBe(1);

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 900 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 600 });
    await act(async () => window.dispatchEvent(new Event("resize")));

    const plotAfterResize = container.querySelector<HTMLElement>('[data-powershow-id="plot-1"]');
    expect(plotAfterResize).toBe(plotBeforeResize);
    expect(plotAfterResize?.innerHTML).toBe(beforeResize);
    expect(requestFrame).toHaveBeenCalledTimes(requestCountBeforeResize);
    expect(callbacks.size).toBe(1);
    expect(cancelFrame).toHaveBeenCalledTimes(cancelCountBeforeResize);
    expect(plotAfterResize?.innerHTML).not.toContain("y = x + t");

    runNextFrame(800);
    expect(plotAfterResize?.innerHTML).not.toBe(beforeResize);
    expect(plotAfterResize?.innerHTML).not.toBe(fromFrame);
    expect(plotAfterResize?.innerHTML).not.toContain("y = x + t");
    expect(callbacks.size).toBe(1);
  });
});
