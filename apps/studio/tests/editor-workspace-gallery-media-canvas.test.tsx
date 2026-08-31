// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "gallery-media-canvas",
    title: "Gallery media canvas",
    slides: [{
      id: "slide-1",
      title: "First",
      elements: [
        {
          type: "gallery",
          id: "gallery-1",
          hidden: false,
          fit: "contain",
          style: { border: { width: 8, color: "#ff0000" }, borderRadius: 24 },
          items: [
            { src: "/one.png", alt: "One", fit: "cover", focalPoint: { x: 10, y: 20 }, crop: { x: 1, y: 2, width: 90, height: 80 } },
            { src: "/two.png", alt: "Two", fit: "fill", focalPoint: { x: 30, y: 40 }, crop: { x: 20, y: 20, width: 50, height: 50 } },
          ],
          layout: { width: 400, height: 300 },
        },
        { type: "image", id: "image-1", hidden: false, src: "/other.png", layout: { width: 120, height: 80 } },
      ],
    }],
  });
}

function pointer(type: string, x: number, y: number, pointerId = 1): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { clientX: { value: x }, clientY: { value: y }, pointerId: { value: pointerId } });
  return event;
}

describe("EditorWorkspace Gallery media canvas editing", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.assign(HTMLElement.prototype, { setPointerCapture: () => {}, releasePointerCapture: () => {}, hasPointerCapture: () => false });
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.dataset.powershowId === "gallery-1" || this.dataset.powershowGalleryIndex !== undefined) {
        return { left: 100, top: 80, right: 500, bottom: 380, width: 400, height: 300, x: 100, y: 80, toJSON: () => ({}) };
      }
      return originalGetBoundingClientRect.call(this);
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  async function mount(): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={presentation()} /></StudioI18nProvider>));
    const gallery = container.querySelector<HTMLElement>('[data-powershow-id="gallery-1"]');
    if (!gallery) throw new Error("Gallery was not rendered");
    await act(async () => gallery.dispatchEvent(pointer("pointerdown", 150, 120)));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select][data-powershow-gallery-index="1"]')?.click());
  }

  function canvasButton(): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes("Edit on Canvas"));
    if (!button) throw new Error("Crop canvas button was not rendered");
    return button;
  }

  function focalCanvasButton(): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter((candidate) => candidate.textContent?.includes("Edit on Canvas"))[1];
    if (!button) throw new Error("Focal canvas button was not rendered");
    return button;
  }

  async function loadSource(): Promise<HTMLImageElement> {
    const source = container.querySelector<HTMLImageElement>("[class*='canvasCropSourceLoader']");
    if (!source) throw new Error("Gallery crop source loader was not rendered");
    Object.defineProperty(source, "naturalWidth", { configurable: true, value: 1200 });
    Object.defineProperty(source, "naturalHeight", { configurable: true, value: 800 });
    await act(async () => source.dispatchEvent(new Event("load")));
    return source;
  }

  it("exposes shared canvas buttons and edits only Gallery item 1 focal point", async () => {
    await mount();
    expect(canvasButton()).not.toBeNull();
    expect(focalCanvasButton()).not.toBeNull();
    await act(async () => focalCanvasButton().click());
    const marker = container.querySelector<HTMLButtonElement>("[class*='canvasFocalMarker']");
    expect(marker?.style.left).toContain("220");
    await act(async () => marker?.dispatchEvent(pointer("pointerdown", 220, 200)));
    await act(async () => marker?.dispatchEvent(pointer("pointerup", 300, 230)));
    expect(container.querySelector<HTMLInputElement>("#gallery-gallery-1-item-1-focal-x")?.value).toBe("50");
    expect(container.querySelector<HTMLInputElement>("#gallery-gallery-1-item-1-focal-y")?.value).toBe("50");
    expect(container.querySelector<HTMLTextAreaElement>("#gallery-gallery-1-item-1-src")?.value).toBe("/two.png");
    expect(container.querySelector<HTMLSelectElement>("#gallery-gallery-1-item-1-fit")?.value).toBe("fill");
  });

  it("loads and commits crop against the selected Gallery item source", async () => {
    await mount();
    await act(async () => canvasButton().click());
    const source = await loadSource();
    expect(source.src).toContain("/two.png");
    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east crop handle was not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 360, 180)));
    expect(container.querySelector<HTMLInputElement>("#gallery-gallery-1-item-1-crop-width")?.value).toBe("65");
    expect(container.querySelector<HTMLInputElement>("#gallery-gallery-1-item-1-crop-x")?.value).toBe("20");
  });

  it("closes stale Gallery canvas modes when selection or top-level element changes", async () => {
    await mount();
    await act(async () => canvasButton().click());
    expect(container.querySelector("[class*='canvasCropSourceLoader']")).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select][data-powershow-gallery-index="0"]')?.click());
    expect(container.querySelector("[class*='canvasCropSourceLoader']")).toBeNull();
    expect(container.querySelector("[class*='canvasCropSelection']")).toBeNull();
    await act(async () => container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.dispatchEvent(pointer("pointerdown", 20, 20)));
    expect(container.querySelector("[class*='canvasCropSourceLoader']")).toBeNull();
  });

  it("closes Crop before a Gallery item removal can retarget the active index", async () => {
    await mount();
    await act(async () => canvasButton().click());
    expect(container.querySelector("[class*='canvasCropSourceLoader']")).not.toBeNull();
    const remove = container.querySelector<HTMLButtonElement>("[data-powershow-gallery-remove]");
    if (!remove) throw new Error("Gallery remove button was not rendered");
    await act(async () => remove.click());
    expect(container.querySelector("[class*='canvasCropSourceLoader']")).toBeNull();
    expect(container.querySelector("[class*='canvasCropSelection']")).toBeNull();
    expect(container.innerHTML).not.toMatch(/cropEditingTarget|focalEditingTarget|galleryItemIndex/);
  });

  it("keeps Crop and Focal mutually exclusive and Escape closes Gallery mode", async () => {
    await mount();
    await act(async () => focalCanvasButton().click());
    expect(container.querySelector("[class*='canvasFocalMarker']")).not.toBeNull();
    await act(async () => canvasButton().click());
    expect(container.querySelector("[class*='canvasFocalMarker']")).toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(container.querySelector("[class*='canvasCropSourceLoader']")).toBeNull();
  });
});
