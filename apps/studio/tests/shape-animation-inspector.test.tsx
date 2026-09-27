// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShapeElement } from "@web-slideshow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { ShapeInspector } from "../src/features/editor/inspector/shape-inspector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const element: ShapeElement = {
  id: "shape-1",
  type: "shape",
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
};

function setValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Shape animation Inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: ShapeElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(previewControls?: { onPlay(): void; onPause(): void; onReset(): void }): Promise<void> {
    state = element;
    const render = () => root.render(
      <StudioI18nProvider>
        <ShapeInspector
          element={state}
          previewControls={previewControls}
          onUpdate={(update) => {
            const next = update(state);
            if (next.type !== "shape") throw new Error("expected Shape update");
            state = next;
            render();
          }}
        />
      </StudioI18nProvider>,
    );
    await act(async () => render());
  }

  function input(id: string): HTMLInputElement {
    const value = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!value) throw new Error(`input not found: ${id}`);
    return value;
  }

  function click(id: string): void {
    const value = host.querySelector<HTMLButtonElement | HTMLInputElement>(`#${id}`);
    if (!value) throw new Error(`control not found: ${id}`);
    value.click();
  }

  it("shows the Animation section and applies a valid rotation as one draft action", async () => {
    await mount();

    expect(host.textContent).toContain("Animation");
    await act(async () => click("shape-animation-enabled"));
    await act(async () => click("shape-animation-rotate-enabled"));
    await act(async () => click("shape-animation-apply"));

    expect(state.animation).toEqual({ durationMs: 2000, rotate: { fromDeg: 0, toDeg: 360 } });
  });

  it("persists translation, skew, timing, and explicit boolean semantics", async () => {
    await mount();

    await act(async () => click("shape-animation-enabled"));
    await act(async () => click("shape-animation-rotate-enabled"));
    await act(async () => click("shape-animation-translate-enabled"));
    await act(async () => click("shape-animation-skew-enabled"));
    await act(async () => {
      setValue(input("shape-animation-translate-to-x"), "25");
      setValue(input("shape-animation-skew-to-y"), "15");
      setValue(input("shape-animation-duration"), "5000");
      click("shape-animation-loop");
      click("shape-animation-autoplay");
    });
    await act(async () => click("shape-animation-apply"));

    expect(state.animation).toEqual({
      durationMs: 5000,
      loop: false,
      autoplay: false,
      rotate: { fromDeg: 0, toDeg: 360 },
      translate: { fromXPercent: 0, fromYPercent: 0, toXPercent: 25, toYPercent: 0 },
      skew: { fromXDeg: 0, fromYDeg: 0, toXDeg: 20, toYDeg: 15 },
    });
  });

  it("rejects invalid duration and an enabled animation with no active channel", async () => {
    await mount();

    await act(async () => click("shape-animation-enabled"));
    await act(async () => click("shape-animation-rotate-enabled"));
    await act(async () => {
      setValue(input("shape-animation-duration"), "0");
      click("shape-animation-apply");
    });
    expect(state.animation).toBeUndefined();
    expect(host.textContent).toContain("Check the animation settings.");

    await act(async () => {
      setValue(input("shape-animation-duration"), "2000");
      click("shape-animation-rotate-enabled");
      click("shape-animation-apply");
    });
    expect(state.animation).toBeUndefined();
  });

  it("resets an unapplied draft and removes an applied animation", async () => {
    await mount();
    await act(async () => click("shape-animation-enabled"));
    await act(async () => click("shape-animation-rotate-enabled"));
    await act(async () => click("shape-animation-apply"));
    expect(state.animation).toBeDefined();

    await act(async () => {
      click("shape-animation-enabled");
      click("shape-animation-reset");
    });
    expect(state.animation).toBeDefined();

    await act(async () => {
      click("shape-animation-enabled");
      click("shape-animation-apply");
    });
    expect(state.animation).toBeUndefined();
  });

  it("routes preview buttons to the Shape controller", async () => {
    const preview = { onPlay: vi.fn(), onPause: vi.fn(), onReset: vi.fn() };
    await mount(preview);
    state = { ...state, animation: { durationMs: 1000, rotate: { fromDeg: 0, toDeg: 90 } } };
    await act(async () => root.render(
      <StudioI18nProvider><ShapeInspector element={state} previewControls={preview} onUpdate={() => undefined} /></StudioI18nProvider>,
    ));

    await act(async () => click("shape-animation-preview-play"));
    await act(async () => click("shape-animation-preview-pause"));
    await act(async () => click("shape-animation-preview-reset"));
    expect(preview.onPlay).toHaveBeenCalledTimes(1);
    expect(preview.onPause).toHaveBeenCalledTimes(1);
    expect(preview.onReset).toHaveBeenCalledTimes(1);
  });
});
