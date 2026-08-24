// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(options: { crop?: boolean; absolute?: boolean; link?: boolean; visual?: boolean } = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "crop-canvas-workspace",
    title: "Crop canvas",
    slides: [
      {
        id: "slide-1",
        title: "First",
        elements: [{
          type: "image",
          id: "image-1",
          src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
          ...(options.crop ? { crop: { x: 20, y: 20, width: 50, height: 50 } } : {}),
          ...(options.link ? { link: { kind: "url", href: "https://example.com" } } : {}),
          ...(options.visual ? {
            style: {
              border: { width: 12, color: "#ff0000" },
              borderRadius: 32,
            },
            effect: {
              shadow: { x: 0, y: 8, blur: 24, color: "#000000" },
            },
          } : {}),
          layout: {
            width: 400,
            height: 300,
            ...(options.absolute ? { position: "absolute", left: 40, top: 50 } : {}),
          },
        }],
      },
      { id: "slide-2", title: "Second" },
    ],
  });
}

function pointer(type: string, x: number, y: number, pointerId = 1): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: pointerId },
  });
  return event;
}

describe("EditorWorkspace crop canvas integration", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.dataset.powershowId === "image-1") {
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

  async function mount(value = presentation()) {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={value} />
        </StudioI18nProvider>,
      );
    });
    const imageRoot = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]');
    if (!imageRoot) throw new Error("image root not rendered");
    await act(async () => imageRoot.dispatchEvent(pointer("pointerdown", 150, 120)));
    return imageRoot;
  }

  async function enterCrop() {
    const reset = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Reset crop"));
    const cropGroup = reset?.parentElement;
    const button = Array.from(cropGroup?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((candidate) => candidate.textContent?.includes("Edit on Canvas"));
    if (!button) throw new Error("crop canvas button not rendered");
    await act(async () => button.click());
  }

  async function loadSource() {
    const source = container.querySelector<HTMLImageElement>("[class*='canvasCropSourceLoader']");
    if (!source) throw new Error("crop source preview not rendered");
    Object.defineProperty(source, "naturalWidth", { configurable: true, value: 1200 });
    Object.defineProperty(source, "naturalHeight", { configurable: true, value: 800 });
    await act(async () => source.dispatchEvent(new Event("load")));
    return source;
  }

  it("enters Crop mode without writing no-crop state and loads the full source", async () => {
    await mount();
    await enterCrop();
    expect(container.querySelector("[class*='canvasCropSourcePreview']")).toBeNull();
    expect(container.querySelector(".canvasResizeOverlay")).toBeNull();
    expect(container.querySelector(".canvasFocalMarker")).toBeNull();
    await loadSource();
    expect(container.querySelectorAll("[class*='canvasCropHandle']")).toHaveLength(8);
    expect(container.querySelector<HTMLInputElement>("#image-crop-x")?.value).toBe("0");
  });

  it("previews pointer movement and commits the pointerup coordinates", async () => {
    await mount(presentation({ crop: true }));
    await enterCrop();
    await loadSource();
    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east handle not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 340, 180)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-width")?.value).toBe("50");
    await act(async () => handle.dispatchEvent(pointer("pointerup", 360, 180)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-width")?.value).toBe("65");
  });

  it("cancels previews and does not dirty on a no-op pointerup", async () => {
    await mount(presentation({ crop: true }));
    await enterCrop();
    await loadSource();
    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east handle not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 320, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointercancel", 320, 180)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-width")?.value).toBe("50");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 300, 180)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-width")?.value).toBe("50");
  });

  it("moves the crop without changing its size and supports corners", async () => {
    await mount(presentation({ crop: true }));
    await enterCrop();
    await loadSource();
    const moveSurface = container.querySelector<HTMLElement>("[class*='canvasCropMoveSurface']");
    if (!moveSurface) throw new Error("crop move surface not rendered");
    await act(async () => moveSurface.dispatchEvent(pointer("pointerdown", 240, 180)));
    await act(async () => moveSurface.dispatchEvent(pointer("pointerup", 280, 220)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-width")?.value).toBe("50");
    expect(container.querySelector<HTMLInputElement>("#image-crop-x")?.value).toBe("30");
    const corner = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleNW']");
    if (!corner) throw new Error("northwest handle not rendered");
    await act(async () => corner.dispatchEvent(pointer("pointerdown", 180, 140)));
    await act(async () => corner.dispatchEvent(pointer("pointerup", 140, 100)));
    expect(container.querySelector<HTMLInputElement>("#image-crop-x")?.value).toBe("20");
  });

  it("keeps absolute and flow layout unchanged and suppresses linked navigation", async () => {
    for (const absolute of [false, true]) {
      await mount(presentation({ absolute, link: true }));
      const locationBefore = window.location.href;
      const before = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.getAttribute("style");
      await enterCrop();
      await loadSource();
      const surface = container.querySelector<HTMLElement>("[class*='canvasCropMoveSurface']");
      if (!surface) throw new Error("crop move surface not rendered");
      await act(async () => surface.dispatchEvent(pointer("pointerdown", 240, 180)));
      await act(async () => surface.dispatchEvent(pointer("pointerup", 280, 220)));
      expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.getAttribute("style")).toBe(before);
      expect(window.location.href).toBe(locationBefore);
      if (!absolute) {
        await act(async () => root.unmount());
        root = createRoot(container);
      }
    }
  });

  it("closes Crop on Escape, Focal activation, selection change, and slide change", async () => {
    await mount();
    await enterCrop();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(container.querySelector("[class*='canvasCropSelection']")).toBeNull();
    await enterCrop();
    const focalGroup = container.querySelector<HTMLInputElement>("#image-focal-x")?.parentElement?.parentElement?.parentElement;
    const focalButton = Array.from(focalGroup?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((button) => button.textContent?.includes("Edit on Canvas"));
    if (focalButton) await act(async () => focalButton.click());
    expect(container.querySelector("[class*='canvasCropSelection']")).toBeNull();

    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    await enterCrop();
    const secondSlide = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Second"));
    if (secondSlide) await act(async () => secondSlide.click());
    expect(container.querySelector("[class*='canvasCropSelection']")).toBeNull();
  });

  it("does not mutate the document when the crop source errors", async () => {
    await mount();
    await enterCrop();
    const source = container.querySelector<HTMLImageElement>("[class*='canvasCropSourceLoader']");
    if (!source) throw new Error("crop source preview not rendered");
    await act(async () => source.dispatchEvent(new Event("error")));
    expect(container.querySelector("[class*='canvasCropHandle']")).toBeNull();
    expect(container.querySelector<HTMLInputElement>("#image-crop-x")?.value).toBe("0");
  });

  it("keeps the authored fixed appearance frame visible during Crop mode", async () => {
    await mount(presentation({ crop: true, visual: true }));
    const imageRoot = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]');
    if (!imageRoot) throw new Error("image root not rendered");
    expect(imageRoot.getAttribute("style")).toContain("border");
    await enterCrop();
    expect(container.querySelector("[class*='canvasCropAppearanceFrame']")).not.toBeNull();
    expect(container.querySelector("[class*='canvasCropAppearanceFrame']")?.getAttribute("style")).toContain("border-radius");
    await loadSource();
    const handle = container.querySelector<HTMLButtonElement>("[class*='canvasCropHandleE']");
    if (!handle) throw new Error("east handle not rendered");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 340, 180)));
    const rerenderedRoot = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]');
    expect(rerenderedRoot?.getAttribute("style")).toContain("border");
    expect(rerenderedRoot?.getAttribute("style")).toContain("border-radius");
    expect(rerenderedRoot?.getAttribute("style")).toContain("box-shadow");
  });

  it("keeps an already-cropped Image rendered when selected", async () => {
    await mount(presentation({ crop: true, visual: true }));
    const imageRoot = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]');
    const viewport = imageRoot?.querySelector<HTMLElement>("[class*='crop-viewport']");
    const media = imageRoot?.querySelector<HTMLImageElement>("img");
    expect(imageRoot).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(media).not.toBeNull();
    Object.defineProperty(media, "naturalWidth", { configurable: true, value: 1200 });
    Object.defineProperty(media, "naturalHeight", { configurable: true, value: 800 });
    await act(async () => media?.dispatchEvent(new Event("load")));
    expect(imageRoot?.querySelector("img")).not.toBeNull();
    expect(imageRoot?.querySelector("[class*='crop-viewport']")).not.toBeNull();
  });
});
