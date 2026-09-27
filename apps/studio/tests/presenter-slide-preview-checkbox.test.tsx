// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema } from "@web-slideshow/document-schema";

import { PresenterSlidePreview } from "../src/features/control/presenter/presenter-slide-preview";
import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("PresenterSlidePreview Checkbox runtime integration", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.body.appendChild(document.createElement("div"));
    root = createRoot(container);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 480, height: 270, top: 0, left: 0, right: 480, bottom: 270,
      x: 0, y: 0, toJSON: () => ({}),
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function presentation() {
    return PresentationSchema.parse({
      ...createBlankPresentation("p", "P"),
      slides: [{
        id: "page-a", title: "A", elements: [
          { id: "topics-a", type: "topics", hidden: false, kind: "checkbox", checkboxMode: "three-state", items: [
            { id: "item-a", content: { id: "content-a", children: [] }, children: [] },
            { id: "item-b", content: { id: "content-b", children: [] }, children: [] },
          ] },
        ],
      }],
    });
  }

  it("hydrates the current preview, resolves DOM-order slots, and keeps next local", async () => {
    const changes: unknown[] = [];
    const current = presentation();
    await act(async () => {
      root.render(<PresenterSlidePreview
        presentation={current}
        slide={current.slides[0]!}
        aspectRatio="16:9"
        variant="current"
        onCheckboxChange={(...args) => changes.push(args)}
      />);
    });
    const inputs = container.querySelectorAll<HTMLInputElement>("input[data-presentation-checkbox='true']");
    expect(inputs).toHaveLength(2);
    await act(async () => inputs[1]?.click());
    expect(changes).toEqual([[1, "topics-a", "item-b", "intermediate"]]);

    changes.length = 0;
    await act(async () => {
      root.render(<PresenterSlidePreview
        presentation={current}
        slide={current.slides[0]!}
        aspectRatio="16:9"
        variant="next"
        onCheckboxChange={(...args) => changes.push(args)}
      />);
    });
    await act(async () => container.querySelector<HTMLInputElement>("input[data-presentation-checkbox='true']")?.click());
    expect(changes).toEqual([]);
  });
});
