import { describe, expect, it } from "vitest";
import { PresentationSchema } from "@web-slideshow/document-schema";

import { findContainerLinkedStyleUsageLocations, findElementsLinkedToStyle, findLinkedStyleUsageLocations, findTargetLinkedStyleUsageLocations } from "../src/features/editor/linked-style-bulk-authoring";

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

  it("finds target usages across every persisted owner in order and enforces exact compatibility", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "p-targets",
      title: "Targets",
      slides: [{
        id: "slide",
        title: "Slide",
        elements: [
          { id: "slide-code", type: "code" as const, hidden: false, code: "x", language: "text", linkedStyleId: "code-style" },
          { id: "slide-terminal", type: "terminal" as const, hidden: false, lines: [], linkedStyleId: "terminal-style" },
          { id: "slide-simple", type: "table" as const, hidden: false, columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], linkedStyleId: "simple-style" },
          { id: "slide-structured", type: "table" as const, mode: "structured" as const, hidden: false, showHeader: true, columns: [], rows: [], linkedStyleId: "structured-style" },
          { id: "slide-divider", type: "divider" as const, hidden: false, linkedStyleId: "divider-style" },
        ],
      }, {
        id: "root-slide",
        title: "Root slide",
        elements: [],
        rootDefinitionId: "root",
        localRootChildren: [{ targetContainerId: "receiver", children: [
          { id: "local-code", type: "code" as const, hidden: false, code: "local", language: "text", linkedStyleId: "code-style" },
        ] }],
      }],
      rootDefinitions: [{
        id: "root",
        name: "Root",
        localChildTargetIds: ["receiver"],
        root: { id: "root-container", type: "container" as const, hidden: false, children: [
          { id: "receiver", type: "container" as const, hidden: false, children: [] },
          { id: "root-divider", type: "divider" as const, hidden: false, linkedStyleId: "divider-style" },
        ] },
      }],
      linkedStyles: [
        { target: "code" as const, id: "code-style", name: "Code", style: { color: "#111" } },
        { target: "terminal" as const, id: "terminal-style", name: "Terminal", style: { outputColor: "#111" } },
        { target: "table" as const, mode: "simple" as const, id: "simple-style", name: "Simple", style: { color: "#111" } },
        { target: "table" as const, mode: "structured" as const, id: "structured-style", name: "Structured", style: { headerBackground: "#111" } },
        { target: "divider" as const, id: "divider-style", name: "Divider", style: { background: { color: "#111" } } },
      ],
    });
    const before = structuredClone(presentation);

    expect(findTargetLinkedStyleUsageLocations(presentation, "code-style")).toEqual([
      { source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "slide-code" },
      { source: "slide-local-root", target: { kind: "slide", slideIndex: 1 }, elementId: "local-code", targetContainerId: "receiver" },
    ]);
    expect(findTargetLinkedStyleUsageLocations(presentation, "terminal-style")).toEqual([
      { source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "slide-terminal" },
    ]);
    expect(findTargetLinkedStyleUsageLocations(presentation, "simple-style")).toEqual([
      { source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "slide-simple" },
    ]);
    expect(findTargetLinkedStyleUsageLocations(presentation, "structured-style")).toEqual([
      { source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "slide-structured" },
    ]);
    expect(findTargetLinkedStyleUsageLocations(presentation, "divider-style")).toEqual([
      { source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "slide-divider" },
      { source: "root-definition", target: { kind: "root-definition", rootDefinitionId: "root" }, elementId: "root-divider" },
    ]);
    expect(findTargetLinkedStyleUsageLocations(presentation, "missing")).toEqual([]);
    expect(presentation).toEqual(before);
  });
});
