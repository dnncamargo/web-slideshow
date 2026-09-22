import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import { visitElements } from "../src/features/editor/element-hierarchy";
import {
  collectPresentationAuthoringIds,
  forEachPresentationAuthoringTree,
} from "../src/features/editor/presentation-authoring-trees";
import { collectAuthoringIds } from "../src/features/editor/element-hierarchy";
import { createElement, duplicateElement } from "../src/features/editor/element-operations";

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

  it("feeds Root/local identities into element generators and reserves sequential results", () => {
    const presentation = PresentationSchema.parse({
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
            "table-element",
            "table-column",
            "table-header-slot",
            "table-header-text",
            "table-row",
            "table-cell-slot",
            "table-cell-text",
          ].map(text),
        },
      }],
      slides: [{
        id: "slide-1",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-definition",
        localRootChildren: [{
          targetContainerId: "root-container",
          children: [
            "text-element",
            "container-element",
            "image-element",
            "topics-element",
            "topic-item",
            "topic-slot",
            "topic-text",
          ].map(text),
        }],
      }],
    });
    const before = structuredClone(presentation);
    const originalIds = collectPresentationAuthoringIds(presentation);
    const usedIds = collectPresentationAuthoringIds(presentation);

    const table = createElement("table", usedIds);
    const topics = createElement("topics", usedIds);
    const firstText = createElement("text", usedIds);
    const secondText = createElement("text", usedIds);

    const tableIds = new Set<string>();
    if (table.type === "table" && table.mode === "structured") {
      tableIds.add(table.id);
      tableIds.add(table.columns[0]!.id);
      tableIds.add(table.columns[0]!.header.id);
      tableIds.add(table.columns[0]!.header.children[0]!.id);
      tableIds.add(table.rows[0]!.id);
      tableIds.add(table.rows[0]!.cells[0]!.id);
      tableIds.add(table.rows[0]!.cells[0]!.children[0]!.id);
    }
    const topicIds = new Set<string>();
    if (topics.type === "topics") {
      topicIds.add(topics.id);
      topicIds.add(topics.items[0]!.id);
      topicIds.add(topics.items[0]!.content.id);
      topicIds.add(topics.items[0]!.content.children[0]!.id);
    }

    expect(tableIds.size).toBe(7);
    expect(topicIds.size).toBe(4);
    expect([...tableIds, ...topicIds, firstText.id, secondText.id].every((id) => !originalIds.has(id))).toBe(true);
    expect(firstText.id).not.toBe(secondText.id);
    expect(presentation).toEqual(before);
  });

  it("uses the full Root/local inventory for recursive element duplication", () => {
    const presentation = canonicalPresentation();
    const source: PresentationElement = {
      id: "source-container",
      type: "container",
      hidden: false,
      children: [
        {
          id: "source-table",
          type: "table",
          mode: "structured",
          hidden: false,
          showHeader: true,
          columns: [{ id: "source-column", header: { id: "source-header-slot", children: [text("source-header-text")] } }],
          rows: [{ id: "source-row", cells: [{ id: "source-cell-slot", children: [text("source-cell-text")] }] }],
        },
        {
          id: "source-topics",
          type: "topics",
          hidden: false,
          kind: "unordered",
          items: [{ id: "source-topic-item", content: { id: "source-topic-slot", children: [text("source-topic-text")] }, children: [] }],
        },
      ],
    };
    const before = structuredClone(source);
    const reserved = collectPresentationAuthoringIds(presentation);
    const duplicate = duplicateElement(source, reserved);
    const duplicateIds = new Set<string>();
    collectAuthoringIds(duplicate, duplicateIds);

    expect([...duplicateIds].every((id) => !collectPresentationAuthoringIds(presentation).has(id))).toBe(true);
    expect(duplicate).not.toEqual(source);
    expect(source).toEqual(before);
  });
});
