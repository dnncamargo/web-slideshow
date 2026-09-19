// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type PowerShowElement,
  type Presentation,
} from "@powershow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  x: number;
  y: number;
  toJSON: () => Record<string, never>;
};

function rect(left: number, top: number, width: number, height: number): Rect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function parseStylePx(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function canvasRect(element: HTMLElement, fallbackWidth: number, fallbackHeight: number): Rect {
  const left = parseStylePx(element.style.left) ?? 100;
  const top = parseStylePx(element.style.top) ?? 80;
  const width = parseStylePx(element.style.width) ?? fallbackWidth;
  const height = parseStylePx(element.style.height) ?? fallbackHeight;
  return rect(left, top, width, height);
}

function pointer(
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1,
  altKey = false,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
    altKey: { value: altKey },
  });
  return event;
}

function keyUndo(): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "z",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
}

function keyRedo(): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "z",
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
}

function makePresentation(elements: PowerShowElement[]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4e2-canvas-resize",
    title: "Canvas resize history",
    slides: [{ id: "slide-1", title: "Slide 1", elements }],
  });
}

function imageElement(overrides: Partial<Extract<PowerShowElement, { type: "image" }>> = {}): PowerShowElement {
  return {
    type: "image",
    id: "image-1",
    hidden: false,
    src: "/image.png",
    alt: "Image",
    fit: "contain",
    layout: { position: "absolute", width: 200, height: 100, left: 100, top: 80 },
    style: { border: { width: 3, style: "solid", color: "#123456" }, borderRadius: 8 },
    effect: { opacity: 0.7 },
    link: { kind: "url", href: "https://example.com" },
    ...overrides,
  };
}

function flowContainerElement(): PowerShowElement {
  return {
    type: "container",
    id: "container-1",
    hidden: false,
    layout: { width: 200, height: 140, children: { direction: "column", gap: 12 } },
    style: { color: "#ffffff", background: { color: "#000000" } },
    effect: { opacity: 0.8 },
    children: [],
  };
}

function absoluteContainerElement(): PowerShowElement {
  return {
    type: "container",
    id: "container-1",
    hidden: false,
    layout: {
      position: "absolute",
      width: 200,
      height: 140,
      left: 100,
      right: 700,
      top: 80,
      bottom: 380,
      children: { direction: "column", gap: 12 },
    },
    style: { color: "#ffffff", background: { color: "#000000" } },
    effect: { opacity: 0.8 },
    link: { kind: "url", href: "https://example.com" },
    children: [],
  };
}

function galleryElement(): PowerShowElement {
  return {
    type: "gallery",
    id: "gallery-1",
    hidden: false,
    items: [{ src: "/image.png", alt: "Gallery item" }],
    fit: "contain",
    layout: { position: "absolute", width: 200, height: 120, left: 100, top: 80 },
    style: { borderRadius: 6 },
    effect: { opacity: 0.9 },
  };
}

describe("CP4E2 canvas resize History integration", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture;
  const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture;
  const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains("powershow-slide") || this.classList.contains("powershow-slide-content")) {
        return rect(0, 0, 1000, 600) as unknown as DOMRect;
      }
      if (this.dataset.powershowType === "container") {
        return canvasRect(this, 200, 140) as unknown as DOMRect;
      }
      if (this.dataset.powershowType === "image") {
        return canvasRect(this, 200, 100) as unknown as DOMRect;
      }
      if (this.dataset.powershowType === "gallery") {
        return canvasRect(this, 200, 120) as unknown as DOMRect;
      }
      return originalGetBoundingClientRect.call(this);
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    HTMLElement.prototype.setPointerCapture = originalSetPointerCapture;
    HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture;
    HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture;
  });

  async function mount(presentation: Presentation): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation} onSave={async () => {}} />
        </StudioI18nProvider>,
      );
    });
  }

  async function select(id: string): Promise<HTMLElement> {
    const element = container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`missing canvas element ${id}`);
    await act(async () => element.dispatchEvent(pointer("pointerdown", 150, 120)));
    return element;
  }

  function resizeHandle(direction: string): HTMLButtonElement {
    const handle = container.querySelector<HTMLButtonElement>(`[aria-label="Resize ${direction}"]`);
    if (!handle) throw new Error(`missing resize handle ${direction}`);
    return handle;
  }

  async function resize(
    id: string,
    direction: string,
    start: { x: number; y: number },
    end: { x: number; y: number },
    pointerId = 2,
  ): Promise<void> {
    await select(id);
    const handle = resizeHandle(direction);
    await act(async () => handle.dispatchEvent(pointer("pointerdown", start.x, start.y, pointerId)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", end.x, end.y, pointerId)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", end.x, end.y, pointerId)));
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(keyUndo()));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(keyRedo()));
  }

  function changeInput(input: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("missing input value setter");
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function editNumber(id: string, value: string): Promise<void> {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`missing input ${id}`);
    await act(async () => {
      input.focus();
      changeInput(input, value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
    });
  }

  it("keeps preview transient, cancels without History, and ignores raw zero delta", async () => {
    await mount(makePresentation([imageElement()]));
    await select("image-1");
    const handle = resizeHandle("se");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 180, 2)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 340, 200, 2)));

    expect(container.querySelector<HTMLElement>("[class*='canvasResizeOverlay']")?.style.width).toBe("240px");
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("200px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("200px");

    await act(async () => handle.dispatchEvent(pointer("pointercancel", 340, 200, 2)));
    expect(container.querySelector<HTMLElement>("[class*='canvasResizeOverlay']")?.style.width).toBe("200px");
    await resize("image-1", "se", { x: 300, y: 180 }, { x: 300, y: 180 }, 3);
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("200px");
  });

  it("treats movement on an irrelevant axis as an effective no-op", async () => {
    await mount(makePresentation([galleryElement()]));
    await select("gallery-1");
    const handle = resizeHandle("e");
    await act(async () => handle.dispatchEvent(pointer("pointerdown", 300, 130, 2)));
    await act(async () => handle.dispatchEvent(pointer("pointermove", 300, 180, 2)));
    await act(async () => handle.dispatchEvent(pointer("pointerup", 300, 180, 2)));
    expect(container.querySelector<HTMLElement>('[data-powershow-id="gallery-1"]')?.style.width).toBe("200px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="gallery-1"]')?.style.width).toBe("200px");
  });

  it("resizes a Flow Container by size only and replays the snapshot", async () => {
    await mount(makePresentation([flowContainerElement()]));
    await resize("container-1", "se", { x: 300, y: 220 }, { x: 340, y: 250 });
    const resized = container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')!;
    expect(resized.style.width).toBe("24%");
    expect(resized.style.height).toContain("%");
    expect(resized.style.position).toBe("");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.width).toBe("200px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.width).toBe("24%");
  });

  it("resizes an absolute Container, preserving unrelated properties", async () => {
    await mount(makePresentation([absoluteContainerElement()]));
    await resize("container-1", "nw", { x: 100, y: 80 }, { x: 80, y: 60 });
    const resized = container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')!;
    expect(resized.style.left).toBe("80px");
    expect(resized.style.top).toBe("60px");
    expect(resized.style.width).toBe("22%");
    expect(resized.style.height).toContain("%");
    expect(resized.style.background).toBe("rgb(0, 0, 0)");
    expect(resized.style.opacity).toBe("0.8");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.left).toBe("100px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.left).toBe("80px");
  });

  it("resizes a locked Image proportionally with one History action", async () => {
    await mount(makePresentation([imageElement()]));
    await resize("image-1", "se", { x: 300, y: 180 }, { x: 340, y: 180 });
    const resized = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;
    expect(resized.style.width).toBe("240px");
    expect(resized.style.height).toBe("120px");
    expect(Number.parseFloat(resized.style.width) / Number.parseFloat(resized.style.height)).toBeCloseTo(2);
    expect(resized.style.borderRadius).toBe("8px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("200px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.height).toBe("120px");
  });

  it("routes a representative Gallery surface through History", async () => {
    await mount(makePresentation([galleryElement()]));
    await resize("gallery-1", "e", { x: 300, y: 130 }, { x: 340, y: 130 });
    expect(container.querySelector<HTMLElement>('[data-powershow-id="gallery-1"]')?.style.width).toBe("240px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="gallery-1"]')?.style.width).toBe("200px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="gallery-1"]')?.style.width).toBe("240px");
  });

  it("keeps a canvas drag and following resize as separate actions", async () => {
    await mount(makePresentation([imageElement()]));
    const image = await select("image-1");
    await act(async () => image.dispatchEvent(pointer("pointermove", 190, 150)));
    await act(async () => image.dispatchEvent(pointer("pointerup", 190, 150)));

    await resize("image-1", "se", { x: 340, y: 210 }, { x: 380, y: 230 });
    const resized = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;
    expect(resized.style.left).toBe("140px");
    expect(resized.style.width).toBe("240px");

    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("140px");
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("200px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("100px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("140px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("240px");
  });

  it("commits a continuous Inspector size edit before the following resize", async () => {
    await mount(makePresentation([flowContainerElement()]));
    await select("container-1");
    await editNumber("container-width", "220");

    await resize("container-1", "e", { x: 320, y: 150 }, { x: 360, y: 150 });
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.width).toBe("26%");

    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.width).toBe("220%");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.width).toBe("200px");
  });

  it("keeps two completed resize gestures independent", async () => {
    await mount(makePresentation([imageElement()]));
    await resize("image-1", "se", { x: 300, y: 180 }, { x: 320, y: 190 });
    await resize("image-1", "se", { x: 320, y: 190 }, { x: 350, y: 205 }, 3);
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("250px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("220px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("200px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("220px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.width).toBe("250px");
  });
});
