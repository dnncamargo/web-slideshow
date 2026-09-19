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

function makePresentation(element: PowerShowElement): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4e1-canvas-drag",
    title: "Canvas drag history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [element],
    }],
  });
}

function containerElement(): PowerShowElement {
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
    style: {
      color: "#ffffff",
      background: { color: "#000000" },
      borderRadius: 4,
    },
    typography: { fontWeight: 600, fontSize: 18 },
    effect: { opacity: 0.8 },
    children: [],
  };
}

function imageElement(): PowerShowElement {
  return {
    type: "image",
    id: "image-1",
    hidden: false,
    src: "/image.png",
    alt: "Image",
    fit: "contain",
    layout: {
      position: "absolute",
      width: 200,
      height: 140,
      left: 100,
      top: 80,
    },
    style: {
      border: { width: 3, style: "solid", color: "#123456" },
      borderRadius: 8,
    },
    effect: { opacity: 0.7 },
  };
}

function dividerElement(): PowerShowElement {
  return {
    type: "divider",
    id: "divider-1",
    hidden: false,
    orientation: "horizontal",
    layout: {
      position: "absolute",
      left: 100,
      top: 80,
    },
  };
}

describe("CP4E1 canvas drag History integration", () => {
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
        return canvasRect(this, 200, 140) as unknown as DOMRect;
      }
      if (this.dataset.powershowType === "divider") {
        return canvasRect(this, 100, 20) as unknown as DOMRect;
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

  async function mount(presentation: Presentation): Promise<HTMLElement> {
      await act(async () => {
        root.render(
          <StudioI18nProvider>
            <EditorWorkspace
              initialPresentation={presentation}
              onSave={async () => {}}
            />
          </StudioI18nProvider>,
        );
    });
    const element = container.querySelector<HTMLElement>("[data-powershow-id]");
    if (!element) throw new Error("expected a rendered canvas element");
    return element;
  }

  async function drag(
    id: string,
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): Promise<HTMLElement> {
    const element = container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`missing canvas element ${id}`);
    await act(async () => element.dispatchEvent(pointer("pointerdown", start.x, start.y)));
    await act(async () => element.dispatchEvent(pointer("pointermove", end.x, end.y)));
    await act(async () => element.dispatchEvent(pointer("pointerup", end.x, end.y)));
    return container.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`) ?? element;
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(keyUndo()));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(keyRedo()));
  }

  it("keeps preview transient, cancels without History, and ignores zero movement", async () => {
    const initial = makePresentation(imageElement());
    await mount(initial);
    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;

    await act(async () => image.dispatchEvent(pointer("pointerdown", 150, 120)));
    await act(async () => image.dispatchEvent(pointer("pointermove", 190, 150)));
    expect(image.style.translate).toBe("40px 30px");
    expect(image.style.left).toBe("100px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("100px");

    await act(async () => image.dispatchEvent(pointer("pointercancel", 190, 150)));
    expect(image.style.translate).toBe("");
    expect(image.style.left).toBe("100px");

    await act(async () => image.dispatchEvent(pointer("pointerdown", 150, 120, 2)));
    await act(async () => image.dispatchEvent(pointer("pointerup", 150, 120, 2)));
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("100px");
  });

  it("commits one absolute Container drag and preserves unrelated properties through undo/redo", async () => {
    const initial = makePresentation(containerElement());
    await mount(initial);

    await drag("container-1", { x: 150, y: 120 }, { x: 190, y: 150 });

    const moved = container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')!;
    expect(moved.style.left).toBe("140px");
    expect(moved.style.top).toBe("110px");
    expect(moved.style.width).toBe("200px");
    expect(moved.style.height).toBe("140px");
    expect(moved.style.background).toBe("rgb(0, 0, 0)");
    expect(moved.style.opacity).toBe("0.8");

    await undo();
    const restored = container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')!;
    expect(restored.style.left).toBe("100px");
    expect(restored.style.right).toBe("700px");
    expect(restored.style.top).toBe("80px");
    await redo();
    const redone = container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')!;
    expect(redone.style.left).toBe("140px");
    expect(redone.style.right).toBe("660px");
  });

  it("commits a real non-Container Image drag with exact undo/redo", async () => {
    const initial = makePresentation(imageElement());
    await mount(initial);
    await drag("image-1", { x: 150, y: 120 }, { x: 190, y: 150 });

    const moved = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;
    expect(moved.style.left).toBe("140px");
    expect(moved.style.top).toBe("110px");
    expect(moved.style.width).toBe("200px");
    expect(moved.style.height).toBe("140px");
    expect(moved.style.borderRadius).toBe("8px");

    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("100px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("140px");
  });

  it("routes a generic Divider drag through canonical History", async () => {
    await mount(makePresentation(dividerElement()));
    await drag("divider-1", { x: 150, y: 120 }, { x: 190, y: 150 });
    expect(container.querySelector<HTMLElement>('[data-powershow-id="divider-1"]')?.style.left).toBe("140px");
    expect(container.querySelector<HTMLElement>('[data-powershow-id="divider-1"]')?.style.top).toBe("110px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="divider-1"]')?.style.left).toBe("100px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="divider-1"]')?.style.left).toBe("140px");
  });

  it("keeps consecutive gestures as independent actions", async () => {
    await mount(makePresentation(imageElement()));
    await drag("image-1", { x: 150, y: 120 }, { x: 190, y: 150 });
    await drag("image-1", { x: 200, y: 170 }, { x: 230, y: 195 });
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("170px");

    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("140px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("100px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("140px");
    await redo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')?.style.left).toBe("170px");
  });

  it("keeps a continuous inspector position edit separate from the following canvas drag", async () => {
    await mount(makePresentation(containerElement()));
    const containerElementNode = container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')!;
    await act(async () => containerElementNode.dispatchEvent(pointer("pointerdown", 150, 120)));
    await act(async () => containerElementNode.dispatchEvent(pointer("pointercancel", 150, 120)));

    const leftInput = container.querySelector<HTMLInputElement>("#container-position-left");
    if (!leftInput) throw new Error("missing container left position input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("missing input value setter");
    await act(async () => leftInput.focus());
    await act(async () => {
      setter.call(leftInput, "120");
      leftInput.dispatchEvent(new Event("input", { bubbles: true }));
      leftInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => leftInput.blur());

    await drag("container-1", { x: 170, y: 120 }, { x: 210, y: 150 });
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.left).toBe("160px");

    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.left).toBe("120px");
    await undo();
    expect(container.querySelector<HTMLElement>('[data-powershow-id="container-1"]')?.style.left).toBe("100px");
  });
});
