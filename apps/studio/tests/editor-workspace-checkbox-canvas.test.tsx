// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation, type TopicItem, type TopicsElement } from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function topicItem(id: string, child?: TopicItem): TopicItem {
  return {
    id,
    content: {
      id: `slot-${id}`,
      children: [{
        id: `text-${id}`,
        type: "text",
        hidden: false,
        variant: "body",
        content: id,
      }],
    },
    children: child === undefined ? [] : [child],
  };
}

function topicsElement(overrides: Partial<Omit<TopicsElement, "type">> = {}): TopicsElement {
  return {
    id: "topics-1",
    type: "topics",
    hidden: false,
    kind: "checkbox",
    items: [topicItem("first", topicItem("nested")), topicItem("second")],
    ...overrides,
  };
}

function presentation(element: TopicsElement): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "checkbox-canvas",
    title: "Checkbox Canvas",
    slides: [{ id: "slide-1", title: "Slide 1", elements: [element] }],
  });
}

function pointerDownEvent(pointerId = 1): Event {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  Object.defineProperty(event, "clientX", { value: 120 });
  Object.defineProperty(event, "clientY", { value: 90 });
  return event;
}

describe("EditorWorkspace Checkbox Canvas interaction", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture;
  const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture;
  const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList.contains("presentation-slide") || this.classList.contains("presentation-slide-content")) {
        return {
          left: 0,
          top: 0,
          right: 960,
          bottom: 540,
          width: 960,
          height: 540,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      }
      if (this.dataset.presentationType === "topics") {
        return {
          left: 100,
          top: 80,
          right: 300,
          bottom: 200,
          width: 200,
          height: 120,
          x: 100,
          y: 80,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return originalGetBoundingClientRect.call(this);
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    HTMLElement.prototype.setPointerCapture = originalSetPointerCapture;
    HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture;
    HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture;
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  async function mount(element = topicsElement()): Promise<HTMLInputElement[]> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation(element)} />
        </StudioI18nProvider>,
      );
    });

    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>(
      '[data-presentation-checkbox="true"]',
    ));
    if (checkboxes.length === 0) throw new Error("Checkboxes were not rendered");
    return checkboxes;
  }

  async function selectWithPointerDown(checkbox: HTMLInputElement): Promise<Event> {
    const event = pointerDownEvent();
    await act(async () => {
      checkbox.dispatchEvent(event);
    });
    return event;
  }

  it("hydrates flow Topics checkboxes and keeps selection in the existing Inspector path", async () => {
    const checkboxes = await mount({ ...topicsElement(), items: [topicItem("flow")] });
    expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("false");

    const event = await selectWithPointerDown(checkboxes[0]!);
    expect(event.defaultPrevented).toBe(false);
    expect(container.querySelector("#topics-kind")).not.toBeNull();

    await act(async () => checkboxes[0]!.click());
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("true");

    const history = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "History");
    if (!history) throw new Error("History tab was not rendered");
    await act(async () => history.click());
    expect(container.textContent).toContain("History is not populated yet.");
  });

  it("keeps absolute Topics checkbox activation native without starting a drag", async () => {
    const checkboxes = await mount(topicsElement({
      layout: { position: "absolute", left: 100, top: 80 },
    }));
    const setPointerCapture = HTMLElement.prototype.setPointerCapture as ReturnType<typeof vi.fn>;
    const checkboxEvent = await selectWithPointerDown(checkboxes[0]!);

    expect(checkboxEvent.defaultPrevented).toBe(false);
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(container.querySelector("#topics-kind")).not.toBeNull();

    await act(async () => checkboxes[0]!.click());
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("true");
  });

  it("uses the shared three-state runtime and keeps TopicItems independent", async () => {
    const checkboxes = await mount(topicsElement({ checkboxMode: "three-state" }));
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.every((checkbox) => checkbox.getAttribute("aria-checked") === "false")).toBe(true);

    await act(async () => checkboxes[0]!.click());
    expect(checkboxes[0]?.checked).toBe(false);
    expect(checkboxes[0]?.indeterminate).toBe(true);
    expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("mixed");
    expect(checkboxes[1]?.getAttribute("aria-checked")).toBe("false");

    await act(async () => checkboxes[0]!.click());
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[0]?.indeterminate).toBe(false);
    expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("true");
    expect(checkboxes[1]?.getAttribute("aria-checked")).toBe("false");
    expect(checkboxes[2]?.getAttribute("aria-checked")).toBe("false");
  });

  it("keeps ordinary absolute Topics pointerdown draggable outside the checkbox", async () => {
    const checkboxes = await mount(topicsElement({
      layout: { position: "absolute", left: 100, top: 80 },
    }));
    const topics = container.querySelector<HTMLElement>('[data-presentation-id="topics-1"]');
    if (!topics) throw new Error("Topics element was not rendered");
    const setPointerCapture = HTMLElement.prototype.setPointerCapture as ReturnType<typeof vi.fn>;
    setPointerCapture.mockClear();

    const event = pointerDownEvent(2);
    await act(async () => topics.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(setPointerCapture).toHaveBeenCalledWith(2);
    expect(checkboxes[0]?.getAttribute("aria-checked")).toBe("false");
  });
});
