import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { visitElements } from "../src/features/editor/element-hierarchy";
import {
  collectPresentationAuthoringIds,
  forEachPresentationAuthoringTree,
} from "../src/features/editor/presentation-authoring-trees";

function text(id: string) {
  return { id, type: "text" as const, hidden: false, variant: "body", content: id };
}

function canonicalPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    rootDefinitions: [{
      id: "root-definition",
      name: "Root Definition",
      localChildTargetIds: ["root-container"],
      root: {
        id: "root-container",
        type: "container",
        hidden: false,
        children: [
          {
            id: "nested-container",
            type: "container",
            hidden: false,
            children: [text("root-nested-text")],
          },
          {
            id: "root-table",
            type: "table",
            mode: "structured",
            hidden: false,
            showHeader: true,
            columns: [{
              id: "root-column",
              header: { id: "root-header-slot", children: [text("root-header-text")] },
            }],
            rows: [{
              id: "root-row",
              cells: [{ id: "root-cell-slot", children: [text("root-cell-text")] }],
            }],
          },
          {
            id: "root-topics",
            type: "topics",
            hidden: false,
            kind: "unordered",
            items: [{
              id: "root-topic-item",
              content: { id: "root-topic-slot", children: [text("root-topic-text")] },
              children: [{
                id: "nested-topic-item",
                content: { id: "nested-topic-slot", children: [text("nested-topic-text")] },
                children: [],
              }],
            }],
          },
        ],
      },
    }],
    slides: [
      {
        id: "slide-1",
        title: "",
        elements: [{
          id: "slide-container",
          type: "container",
          hidden: false,
          children: [text("slide-nested-text")],
        }],
      },
      {
        id: "slide-2",
        title: "",
        elements: [],
        rootDefinitionId: "root-definition",
        localRootChildren: [{
          targetContainerId: "root-container",
          children: [text("local-root-text")],
        }],
      },
      {
        id: "slide-3",
        title: "",
        elements: [],
        rootDefinitionId: "root-definition",
      },
    ],
  });
}

describe("canonical Presentation authoring trees", () => {
  it("visits slide elements, local Root children, and each Root Definition once", () => {
    const presentation = canonicalPresentation();
    const before = structuredClone(presentation);
    const visited: string[] = [];

    forEachPresentationAuthoringTree(presentation, (elements) => {
      visitElements(elements, (element) => visited.push(element.id));
    });

    expect(visited).toEqual(expect.arrayContaining([
      "slide-container",
      "slide-nested-text",
      "local-root-text",
      "root-container",
      "nested-container",
      "root-nested-text",
      "root-table",
      "root-header-text",
      "root-cell-text",
      "root-topics",
      "root-topic-text",
      "nested-topic-text",
    ]));
    expect(visited.filter((id) => id === "root-container")).toHaveLength(1);
    expect(presentation).toEqual(before);
  });

  it("collects the full canonical authoring ID inventory without materializing slides", () => {
    const presentation = canonicalPresentation();
    const ids = collectPresentationAuthoringIds(presentation);

    expect(ids).toEqual(new Set([
      "slide-1",
      "slide-2",
      "slide-3",
      "root-definition",
      "slide-container",
      "slide-nested-text",
      "local-root-text",
      "root-container",
      "nested-container",
      "root-nested-text",
      "root-table",
      "root-column",
      "root-header-slot",
      "root-header-text",
      "root-row",
      "root-cell-slot",
      "root-cell-text",
      "root-topics",
      "root-topic-item",
      "root-topic-slot",
      "root-topic-text",
      "nested-topic-item",
      "nested-topic-slot",
      "nested-topic-text",
    ]));
    expect(ids).not.toContain("root-definition-workspace:root-definition");
  });

  it("reserves duplicate historical values with Set semantics and does not mutate the source", () => {
    const presentation = canonicalPresentation();
    const historicalDuplicate = PresentationSchema.parse({
      ...presentation,
      slides: presentation.slides.map((slide, index) =>
        index === 0 ? { ...slide, id: "root-definition" } : slide,
      ),
    });
    const before = structuredClone(historicalDuplicate);

    expect(() => collectPresentationAuthoringIds(historicalDuplicate)).not.toThrow();
    expect(collectPresentationAuthoringIds(historicalDuplicate).has("root-definition")).toBe(true);
    expect(historicalDuplicate).toEqual(before);
  });
});
