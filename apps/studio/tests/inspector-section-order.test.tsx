// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ContainerElement,
  ImageElement,
  InteractiveElement,
  PresentationElement,
  ShapeElement,
  TextElement,
} from "@web-slideshow/document-schema";

import { ElementInspector } from "../src/features/editor/element-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type {
  TableAuthoringControls,
  TopicsAuthoringControls,
} from "../src/features/editor/inspector/inspector-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const topicsAuthoringControls: TopicsAuthoringControls = {
  onAddTopLevelTopic: () => null,
  onAddChildTopic: () => null,
};

const tableAuthoringControls: TableAuthoringControls = {
  onAddColumn: () => {},
  onRemoveColumn: () => {},
  onAddRow: () => {},
  onRemoveRow: () => {},
  onShowHeaderChange: () => {},
};

function textElement(): TextElement {
  return {
    id: "text-1",
    type: "text",
    hidden: false,
    variant: "body",
    content: "Text",
  };
}

function imageElement(): ImageElement {
  return {
    id: "image-1",
    type: "image",
    hidden: false,
    src: "/assets/example.png",
    alt: "Example",
    fit: "contain",
  };
}

function containerElement(): ContainerElement {
  return {
    id: "container-1",
    type: "container",
    hidden: false,
    children: [],
  };
}

function shapeElement(): ShapeElement {
  return {
    id: "shape-1",
    type: "shape",
    hidden: false,
    geometry: { mode: "generated", generator: "triangle", config: { apexX: 50 } },
  };
}

function interactiveElement(): InteractiveElement {
  return {
    id: "interactive-1",
    type: "interactive",
    hidden: false,
    widget: "function-plot",
    config: {},
  };
}

describe("canonical Inspector section order", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function renderElement(element: PresentationElement): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementInspector
            element={element}
            onUpdate={() => {}}
            fontResources={[]}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={null}
            layerControls={{ index: 0, count: 1, onMoveTo: () => {} }}
            topicsAuthoringControls={topicsAuthoringControls}
            tableAuthoringControls={tableAuthoringControls}
          />
        </StudioI18nProvider>,
      );
    });
  }

  function sectionTitles(): string[] {
    return Array.from(container.querySelectorAll("details"))
      .filter((section) => section.parentElement === container)
      .map((section) => section.querySelector("summary > span:first-child")?.textContent ?? "");
  }

  it.each([
    ["Text", textElement, ["Effects", "Placement", "Interaction"]],
    ["Image", imageElement, ["Effects", "Placement", "Interaction"]],
    ["Shape", shapeElement, ["Effects", "Placement", "Interaction"]],
  ] as const)("keeps %s Placement immediately before Interaction", async (_name, createElement, tail) => {
    await renderElement(createElement());

    expect(sectionTitles().slice(-3)).toEqual(tail);
    expect(sectionTitles().filter((title) => title === "Interaction")).toHaveLength(1);
    expect(sectionTitles().indexOf("Placement")).toBeLessThan(sectionTitles().indexOf("Interaction"));
  });

  it("keeps the Container tail canonical and retains Position as the inner control", async () => {
    await renderElement(containerElement());

    expect(sectionTitles()).toEqual([
      "Linked style",
      "Layout",
      "Size",
      "Spacing",
      "Appearance",
      "Effects",
      "Placement",
      "Interaction",
    ]);
    expect(container.querySelector("#container-position-mode")?.closest("details")?.querySelector("summary")?.textContent).toBe("Placement");
    expect(container.querySelector("#container-position-mode")?.closest("label")?.textContent).toContain("Position");
    expect(sectionTitles().filter((title) => title === "Interaction")).toHaveLength(1);
  });

  it("leaves generic non-linkable Placement as the final section", async () => {
    await renderElement(interactiveElement());

    expect(sectionTitles().at(-1)).toBe("Placement");
    expect(sectionTitles()).not.toContain("Interaction");
  });
});
