import { describe, expect, it } from "vitest";
import { PresentationSchema } from "@web-slideshow/document-schema";

import { findContainerLinkedStyleUsageLocations, findElementsLinkedToStyle, findLinkedStyleUsageLocations } from "../src/features/editor/linked-style-bulk-authoring";

describe("Linked Style usage locations", () => {
  it("finds direct and nested Container and Topics references by linkedStyleId", () => {
    const nestedTopics = { id: "nested-topics", type: "topics" as const, hidden: false, kind: "unordered" as const, linkedStyleId: "topics-style", items: [] };
    const nestedContainer = { id: "nested-container", type: "container" as const, hidden: false, linkedStyleId: "container-style", children: [] };
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "p",
      title: "P",
      slides: [{
        id: "s",
        title: "S",
        elements: [
          { id: "direct-topics", type: "topics" as const, hidden: false, kind: "unordered" as const, linkedStyleId: "topics-style", items: [] },
          { id: "direct-container", type: "container" as const, hidden: false, linkedStyleId: "container-style", children: [nestedContainer] },
          { id: "topics-parent", type: "topics" as const, hidden: false, kind: "unordered" as const, items: [{ id: "item", content: { id: "slot", children: [nestedTopics] }, children: [] }] },
          { id: "unrelated", type: "topics" as const, hidden: false, kind: "unordered" as const, linkedStyleId: "other-style", items: [] },
        ],
      }],
      linkedStyles: [
        { target: "topics" as const, id: "topics-style", name: "Shared", itemGap: 8 },
        { id: "container-style", name: "Shared", layout: { margin: 4 } },
        { target: "topics" as const, id: "other-style", name: "Other", itemGap: 4 },
      ],
    });

    expect(findElementsLinkedToStyle(presentation, "topics-style")).toEqual([
      { slideIndex: 0, elementId: "direct-topics" },
      { slideIndex: 0, elementId: "nested-topics" },
    ]);
    expect(findElementsLinkedToStyle(presentation, "container-style")).toEqual([
      { slideIndex: 0, elementId: "direct-container" },
      { slideIndex: 0, elementId: "nested-container" },
    ]);
    expect(findElementsLinkedToStyle(presentation, "other-style")).toEqual([
      { slideIndex: 0, elementId: "unrelated" },
    ]);
    expect(findElementsLinkedToStyle(presentation, "Shared")).toEqual([]);
  });

  it("finds owner-aware Container and Topics usages in Root Definitions", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "p-root",
      title: "P",
      slides: [{ id: "s", title: "S", elements: [
        { id: "slide-container", type: "container" as const, hidden: false, linkedStyleId: "container-style", children: [] },
        { id: "slide-topics", type: "topics" as const, hidden: false, kind: "unordered" as const, linkedStyleId: "topics-style", items: [] },
      ] }],
      rootDefinitions: [{
        id: "root-1",
        name: "Teaching master",
        root: { id: "root-container", type: "container" as const, hidden: false, linkedStyleId: "container-style", children: [
          { id: "root-topics", type: "topics" as const, hidden: false, kind: "unordered" as const, linkedStyleId: "topics-style", items: [] },
        ] },
      }],
      linkedStyles: [
        { id: "container-style", name: "Container", layout: { margin: 4 } },
        { target: "topics" as const, id: "topics-style", name: "Topics", itemGap: 4 },
      ],
    });

    expect(findContainerLinkedStyleUsageLocations(presentation, "container-style")).toEqual([
      { target: { kind: "slide", slideIndex: 0 }, elementId: "slide-container" },
      { target: { kind: "root-definition", rootDefinitionId: "root-1" }, elementId: "root-container" },
    ]);
    expect(findLinkedStyleUsageLocations(presentation, "topics-style")).toEqual([
      { target: { kind: "slide", slideIndex: 0 }, elementId: "slide-topics" },
      { target: { kind: "root-definition", rootDefinitionId: "root-1" }, elementId: "root-topics" },
    ]);
  });
});
