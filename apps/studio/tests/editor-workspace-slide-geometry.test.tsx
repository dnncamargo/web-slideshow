// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type { PresentationNotesRepository } from "../src/features/persistence/presentation-notes-repository";

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

function pointer(type: string, x: number, y: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
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
    vi.useRealTimers();
    globalThis.ResizeObserver = originalResizeObserver;
    document.body.innerHTML = "";
  });

  async function mount(
    value = presentation(),
    notesRepository?: PresentationNotesRepository,
  ) {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={value}
            notesRepository={notesRepository}
          />
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
    const slide = container.querySelector<HTMLElement>(".presentation-slide");

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

  it("renders private markers above the slide even when the Notes panel is closed", async () => {
    const notesRepository: PresentationNotesRepository = {
      getNotes: vi.fn(async () => ({
        bySlideId: {
          "slide-1": {
            text: "ordinary",
            pointed: [
              { id: "pointed-a", text: "first", x: 480, y: 270 },
              { id: "pointed-b", text: "second", x: 700, y: 400 },
            ],
          },
        },
      })),
      setSlideNotes: vi.fn(async () => undefined),
    };

    const viewport = await mount(presentation(), notesRepository);
    setViewportSize(viewport, 1024, 604);
    await act(async () => {
      await Promise.resolve();
    });

    const markers = Array.from(
      container.querySelectorAll<HTMLButtonElement>("[data-pointed-note-marker]"),
    );
    expect(markers.map((marker) => marker.textContent)).toEqual(["1", "2"]);
    expect(markers.map((marker) => marker.dataset.pointedNoteId)).toEqual([
      "pointed-a",
      "pointed-b",
    ]);
    expect(container.querySelector("[data-pointed-note-layer]")).not.toBeNull();
    expect(container.querySelector("[class*='notesWorkspace']")).toBeNull();
    expect(markers[0]?.textContent).not.toContain("[");
  });

  it("previews marker movement in logical coordinates and saves once on pointerup", async () => {
    vi.useFakeTimers();
    const notesRepository: PresentationNotesRepository = {
      getNotes: vi.fn(async () => ({
        bySlideId: {
          "slide-1": {
            text: "ordinary",
            pointed: [
              { id: "pointed-a", text: "first", x: 480, y: 270 },
              { id: "pointed-b", text: "second", x: 700, y: 400 },
            ],
          },
        },
      })),
      setSlideNotes: vi.fn(async () => undefined),
    };

    const viewport = await mount(presentation(), notesRepository);
    setViewportSize(viewport, 544, 334);
    await act(async () => {
      await Promise.resolve();
    });

    const marker = container.querySelector<HTMLButtonElement>(
      '[data-pointed-note-id="pointed-a"]',
    );
    if (!marker) throw new Error("expected pointed marker");

    await act(async () => {
      marker.dispatchEvent(pointer("pointerdown", 100, 100));
      marker.dispatchEvent(pointer("pointermove", 140, 120));
    });

    expect(marker.style.left).toBe("560px");
    expect(marker.style.top).toBe("310px");
    expect(notesRepository.setSlideNotes).not.toHaveBeenCalled();
    expect(container.textContent).toContain("No element selected");

    await act(async () => {
      marker.dispatchEvent(pointer("pointerup", 140, 120));
    });

    expect(notesRepository.setSlideNotes).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(notesRepository.setSlideNotes).toHaveBeenCalledTimes(1);
    expect(notesRepository.setSlideNotes).toHaveBeenCalledWith(
      "geometry-16:9",
      "slide-1",
      {
        text: "ordinary",
        pointed: [
          { id: "pointed-a", text: "first", x: 560, y: 310 },
          { id: "pointed-b", text: "second", x: 700, y: 400 },
        ],
      },
    );
  });
});
