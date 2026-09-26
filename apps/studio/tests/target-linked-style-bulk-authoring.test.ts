import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import {
  attachTargetLinkedStyleToMatchingElements,
  findMatchingTargetElementsForLinkedStyle,
} from "../src/features/editor/linked-style-bulk-authoring";

function documentWithTargets(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    linkedStyles: [
      { target: "code", id: "code-style", name: "Code", style: { color: "#123456" }, effect: { opacity: 0 } },
      { target: "terminal", id: "terminal-style", name: "Terminal", style: { outputColor: "#654321" }, titleTypography: { fontSize: 12 } },
      { target: "table", mode: "simple", id: "simple-style", name: "Simple", style: { color: "#abcdef" } },
      { target: "table", mode: "structured", id: "structured-style", name: "Structured", style: { dividerOpacity: 0 } },
      { target: "divider", id: "divider-style", name: "Divider", style: { background: { color: "#fedcba" } } },
    ],
    slides: [{
      id: "slide",
      title: "Slide",
      elements: [
        { id: "code", type: "code", hidden: false, code: "x", language: "ts", style: { color: "#123456", className: "keep" }, effect: { opacity: 0 }, layout: { position: "absolute", left: 20 } },
        { id: "terminal-parent", type: "container", hidden: false, children: [{ id: "terminal", type: "terminal", hidden: false, lines: [], title: "Shell", titleStyle: { color: "#111111" }, style: { outputColor: "#654321" }, titleTypography: { fontSize: 12 } }] },
        { id: "simple", type: "table", hidden: false, columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ada" }], style: { color: "#abcdef" } },
        { id: "structured-wrong", type: "table", mode: "structured", hidden: false, showHeader: false, columns: [{ id: "c", header: { id: "h", children: [] } }], rows: [{ id: "r", cells: [{ id: "cell", children: [] }] }], style: { dividerOpacity: 1 } },
      ],
    }, {
      id: "root-slide",
      title: "Root Slide",
      rootDefinitionId: "root-definition",
      elements: [],
      localRootChildren: [{ targetContainerId: "root", children: [
        { id: "divider", type: "divider", hidden: false, orientation: "vertical", style: { background: { color: "#fedcba" }, className: "local" }, layout: { width: 2 } },
      ] }],
    }],
    rootDefinitions: [{ id: "root-definition", name: "Root", localChildTargetIds: ["root"], root: {
      id: "root", type: "container", hidden: false, children: [
        { id: "structured", type: "table", mode: "structured", hidden: false, showHeader: false, columns: [{ id: "c", header: { id: "h", children: [] } }], rows: [{ id: "r", cells: [{ id: "cell", children: [] }] }], style: { dividerOpacity: 0 } },
      ],
    } }],
  });
}

describe("target linked-style matching and bulk attachment", () => {
  it("discovers every target in deterministic owner order and applies exact compatibility", () => {
    const presentation = documentWithTargets();
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "code-style")).toEqual([{ source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "code" }]);
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "terminal-style")).toEqual([{ source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "terminal" }]);
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "simple-style")).toEqual([{ source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "simple" }]);
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "structured-style")).toEqual([{ source: "root-definition", target: { kind: "root-definition", rootDefinitionId: "root-definition" }, elementId: "structured" }]);
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "divider-style")).toEqual([{ source: "slide-local-root", target: { kind: "slide", slideIndex: 1 }, targetContainerId: "root", elementId: "divider" }]);
  });

  it("matches authored leaves only, rejects linked or wrong-mode elements, and preserves local extras", () => {
    const presentation = documentWithTargets();
    const withNonmatches = PresentationSchema.parse({
      ...presentation,
      slides: [{ ...presentation.slides[0]!, elements: [
        ...presentation.slides[0]!.elements,
        { id: "code-missing", type: "code", hidden: false, code: "y", language: "ts", style: { color: "#123456" } },
        { id: "code-linked", type: "code", hidden: false, code: "z", language: "ts", linkedStyleId: "code-style", style: { color: "#123456" }, effect: { opacity: 0 } },
      ] }],
    });
    expect(findMatchingTargetElementsForLinkedStyle(withNonmatches, "code-style")).toHaveLength(1);
    const result = attachTargetLinkedStyleToMatchingElements(withNonmatches, "code-style");
    expect(result.attachedLocations).toHaveLength(1);
    expect(result.presentation.slides[0]!.elements[0]).toMatchObject({ linkedStyleId: "code-style", style: { className: "keep" }, layout: { left: 20 } });
    expect(result.presentation.linkedStyles).toEqual(withNonmatches.linkedStyles);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
    const second = attachTargetLinkedStyleToMatchingElements(result.presentation, "code-style");
    expect(second.presentation).toBe(result.presentation);
    expect(second.attachedLocations).toEqual([]);
  });

  it("attaches all owner trees atomically and fails closed for unsupported styles", () => {
    const presentation = documentWithTargets();
    const before = structuredClone(presentation);
    const result = attachTargetLinkedStyleToMatchingElements(presentation, "divider-style");
    expect(result.attachedLocations).toEqual([{ source: "slide-local-root", target: { kind: "slide", slideIndex: 1 }, targetContainerId: "root", elementId: "divider" }]);
    expect(result.presentation.slides[1]!.localRootChildren![0]!.children[0]).toMatchObject({ linkedStyleId: "divider-style", orientation: "vertical", style: { className: "local" } });
    expect(result.presentation.rootDefinitions).toEqual(before.rootDefinitions);
    expect(attachTargetLinkedStyleToMatchingElements(presentation, "missing")).toEqual({ presentation, attachedLocations: [] });
  });
});
