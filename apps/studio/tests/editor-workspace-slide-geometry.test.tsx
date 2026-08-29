// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  callback: ResizeObserverCallback;
  element: Element | null = null;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(element: Element): void {
    this.element = element;
  }

  disconnect(): void {
    this.element = null;
  }

  notify(): void {
    if (this.element) {
      this.callback([], this as unknown as ResizeObserver);
    }
  }
}

function presentation(aspectRatio: "16:9" | "4:3" = "16:9"): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: `geometry-${aspectRatio}`,
    title: "Geometry",
    aspectRatio,
    slides: [{
      id: "slide-1",
      title: "First",
      elements: [{
        type: "image",
        id: "image-1",
        src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
        layout: { width: "50%", height: 100 },
      }],
    }],
  });
}

function fittedContainerPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "fit-canvas-guards",
    title: "Fit canvas guards",
    aspectRatio: "16:9",
    slides: [{
      id: "slide-1",
      title: "First",
      elements: [{
        type: "container",
        id: "fit-container",
        hidden: false,
        layout: {
          position: "absolute",
          left: 50,
          top: 40,
          width: 600,
          height: 400,
          children: {
            fit: { mode: "contain", sourceWidth: 600, sourceHeight: 400 },
          },
        },
        children: [{
          type: "image",
          id: "fit-child",
          hidden: false,
          src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
          layout: {
            position: "absolute",
            left: 40,
            top: 30,
            width: 120,
            height: 80,
          },
        }],
      }],
    }],
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

describe("EditorWorkspace slide geometry", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    ResizeObserverMock.instances = [];
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    globalThis.ResizeObserver = originalResizeObserver;
    document.body.innerHTML = "";
  });

  async function mount(value = presentation()) {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={value} />
        </StudioI18nProvider>,
      );
    });

    const viewport = container.querySelector<HTMLElement>("[class*='canvasViewport']");
    if (!viewport) throw new Error("canvas viewport not rendered");
    return viewport;
  }

  function setViewportSize(viewport: HTMLElement, width: number, height: number): void {
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: width });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: height });
    const observer = ResizeObserverMock.instances[0];
    if (!observer) throw new Error("resize observer not installed");
    act(() => observer.notify());
  }

  it("keeps a 16:9 logical surface and fits a constrained viewport", async () => {
    const viewport = await mount();
    setViewportSize(viewport, 544, 334);

    const stage = container.querySelector<HTMLElement>("[class*='canvasStage']");
    const canvas = container.querySelector<HTMLElement>("[class*='slideCanvas']");
    const slide = container.querySelector<HTMLElement>(".powershow-slide");

    expect(stage?.style.width).toBe("480px");
    expect(stage?.style.height).toBe("270px");
    expect(canvas?.style.width).toBe("960px");
    expect(canvas?.style.height).toBe("540px");
    expect(canvas?.style.transform).toBe("scale(0.5)");
    expect(canvas?.contains(slide ?? null)).toBe(true);
  });

  it("caps a large 16:9 Studio viewport at scale 1", async () => {
    const viewport = await mount();
    setViewportSize(viewport, 2000, 1200);

    const stage = container.querySelector<HTMLElement>("[class*='canvasStage']");
    const canvas = container.querySelector<HTMLElement>("[class*='slideCanvas']");

    expect(stage?.style.width).toBe("960px");
    expect(stage?.style.height).toBe("540px");
    expect(canvas?.style.transform).toBe("scale(1)");
  });

  it("uses the 4:3 logical surface and preserves its ratio when constrained", async () => {
    const viewport = await mount(presentation("4:3"));
    setViewportSize(viewport, 512, 424);

    const stage = container.querySelector<HTMLElement>("[class*='canvasStage']");
    const canvas = container.querySelector<HTMLElement>("[class*='slideCanvas']");

    expect(stage?.style.width).toBe("448px");
    expect(stage?.style.height).toBe("336px");
    expect(canvas?.style.width).toBe("960px");
    expect(canvas?.style.height).toBe("720px");
    expect(canvas?.style.transform).toBe("scale(0.4666666666666667)");
  });

  it("changes fitted geometry on viewport resize without changing logical dimensions", async () => {
    const viewport = await mount();
    setViewportSize(viewport, 512, 334);
    setViewportSize(viewport, 1024, 604);

    const stage = container.querySelector<HTMLElement>("[class*='canvasStage']");
    const canvas = container.querySelector<HTMLElement>("[class*='slideCanvas']");

    expect(stage?.style.width).toBe("960px");
    expect(stage?.style.height).toBe("540px");
    expect(canvas?.style.width).toBe("960px");
    expect(canvas?.style.height).toBe("540px");
    expect(canvas?.style.transform).toBe("scale(1)");
  });

  it("keeps Editor overlays outside the transformed logical surface", async () => {
    const viewport = await mount();
    const canvas = container.querySelector<HTMLElement>("[class*='slideCanvas']");
    const overlays = Array.from(viewport.querySelectorAll<HTMLElement>("[class*='Overlay'], [class*='Marker'], [class*='Guide']"));

    expect(canvas).not.toBeNull();
    expect(overlays.every((overlay) => !canvas?.contains(overlay))).toBe(true);
  });

  it("selects fitted descendants without direct manipulation while keeping the outer Container resizable", async () => {
    const viewport = await mount(fittedContainerPresentation());
    setViewportSize(viewport, 960, 540);

    const canvas = container.querySelector<HTMLElement>("[class*='slideCanvas']");
    const child = container.querySelector<HTMLElement>('[data-powershow-id="fit-child"]');
    const outer = container.querySelector<HTMLElement>('[data-powershow-id="fit-container"]');
    const surface = container.querySelector<HTMLElement>(".powershow-container-fit-surface");
    if (!canvas || !child || !outer || !surface) throw new Error("fit canvas elements not rendered");
    expect(surface.contains(child)).toBe(true);

    const childStyle = child.getAttribute("style");
    await act(async () => {
      child.dispatchEvent(pointer("pointerdown", 180, 150));
      await Promise.resolve();
    });
    const selectedChild = container.querySelector<HTMLElement>('[data-powershow-id="fit-child"]');
    const selectedOuter = container.querySelector<HTMLElement>('[data-powershow-id="fit-container"]');
    if (!selectedChild || !selectedOuter) throw new Error("fit elements were replaced during selection");
    expect(container.textContent).toContain("Image · fit-child");
    expect(selectedChild.classList.contains("powershow-editor-draggable")).toBe(false);
    expect(container.querySelector("[class*='ResizeOverlay']")).toBeNull();

    await act(async () => canvas.dispatchEvent(pointer("pointermove", 260, 220)));
    await act(async () => canvas.dispatchEvent(pointer("pointerup", 260, 220)));
    expect(selectedChild.getAttribute("style")).toBe(childStyle);

    const currentOuter = container.querySelector<HTMLElement>('[data-powershow-id="fit-container"]');
    if (!currentOuter) throw new Error("fit Container was replaced during pointer handling");
    const viewportSurface = currentOuter.querySelector<HTMLElement>(".powershow-container-fit-viewport");
    if (!viewportSurface) throw new Error("fit viewport not rendered");
    await act(async () => {
      viewportSurface.dispatchEvent(pointer("pointerdown", 120, 100, 2));
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Container · fit-container");
    expect(container.querySelector("[class*='ResizeOverlay']")).not.toBeNull();
  });
});
