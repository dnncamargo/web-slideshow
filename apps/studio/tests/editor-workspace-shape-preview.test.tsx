// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "shape-preview-workspace",
    title: "Shape preview workspace",
    aspectRatio: "16:9",
    slides: [{
      id: "slide-1",
      title: "Shape",
      elements: [{
        type: "shape",
        id: "shape-1",
        hidden: false,
        geometry: {
          mode: "path",
          viewBox: { x: 0, y: 0, width: 100, height: 100 },
          commands: [
            { type: "move", x: 0, y: 0 },
            { type: "line", x: 100, y: 0 },
            { type: "line", x: 100, y: 100 },
            { type: "close" },
          ],
        },
        animation: {
          durationMs: 1000,
          loop: false,
          translate: { fromXPercent: 0, fromYPercent: 0, toXPercent: 20, toYPercent: 0 },
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

describe("EditorWorkspace Shape preview", () => {
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

  it("hydrates Shape preview controls on the effective Studio canvas", async () => {
    await act(async () => root.render(
      <StudioI18nProvider><EditorWorkspace initialPresentation={presentation()} /></StudioI18nProvider>,
    ));

    const shape = container.querySelector<HTMLElement>('[data-presentation-id="shape-1"]');
    if (!shape) throw new Error("Shape was not rendered");
    expect(requestFrame).not.toHaveBeenCalled();

    await act(async () => shape.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const play = container.querySelector<HTMLButtonElement>("#shape-animation-preview-play");
    const pause = container.querySelector<HTMLButtonElement>("#shape-animation-preview-pause");
    const reset = container.querySelector<HTMLButtonElement>("#shape-animation-preview-reset");
    if (!play || !pause || !reset) throw new Error("Shape preview controls were not rendered");

    await act(async () => play.click());
    expect(requestFrame).toHaveBeenCalledTimes(1);
    runNextFrame(100);
    const initial = shape.style.transform;
    runNextFrame(600);
    expect(shape.style.transform).not.toBe(initial);

    await act(async () => pause.click());
    const paused = shape.style.transform;
    expect(callbacks.size).toBe(0);
    await act(async () => reset.click());
    expect(shape.style.transform).toBe("translate(0%, 0%)");
    expect(shape.style.transform).not.toBe(paused);
  });
});
