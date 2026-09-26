import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import {
  attachTargetLinkedStyleToMatchingElements,
  findMatchingTargetElementsForLinkedStyle,
} from "../src/features/editor/linked-style-bulk-authoring";

import {
  resolveLinkedCodeStyle,
  resolveLinkedDividerStyle,
  resolveLinkedTableStyle,
  resolveLinkedTerminalStyle,
} from "@web-slideshow/document-schema";

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

function duplicateIdCodePresentation(): Presentation {
  const code = (id: string) => ({ id, type: "code", hidden: false, code: "x", language: "ts", style: { color: "#123456" } });
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "duplicate-ids",
    title: "Duplicate IDs",
    linkedStyles: [{ target: "code", id: "code-style", name: "Code", style: { color: "#123456" } }],
    slides: [
      { id: "ordinary", title: "Ordinary", elements: [code("same-id")] },
      { id: "second-slide", title: "Second", elements: [code("same-id")] },
    ],
    rootDefinitions: [{ id: "root-1", name: "Root", localChildTargetIds: ["root"], root: { id: "root", type: "container", hidden: false, children: [code("same-id")] } }],
  });
}

function findElement(elements: readonly PresentationElement[], id: string): PresentationElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.type === "container") {
      const nested = findElement(element.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

describe("target linked-style matching and bulk attachment", () => {
  it("treats duplicate element IDs as separate persisted owner occurrences", () => {
    const presentation = duplicateIdCodePresentation();
    const locations = findMatchingTargetElementsForLinkedStyle(presentation, "code-style");
    expect(locations).toEqual([
      { source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "same-id" },
      { source: "slide", target: { kind: "slide", slideIndex: 1 }, elementId: "same-id" },
      { source: "root-definition", target: { kind: "root-definition", rootDefinitionId: "root-1" }, elementId: "same-id" },
    ]);

    const result = attachTargetLinkedStyleToMatchingElements(presentation, "code-style");
    expect(result.attachedLocations).toHaveLength(3);
    expect(result.presentation.slides[0]!.elements[0]).toMatchObject({ linkedStyleId: "code-style" });
    expect(result.presentation.slides[1]!.elements[0]).toMatchObject({ linkedStyleId: "code-style" });
    expect(result.presentation.rootDefinitions![0]!.root.children[0]).toMatchObject({ linkedStyleId: "code-style" });
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);

    const second = attachTargetLinkedStyleToMatchingElements(result.presentation, "code-style");
    expect(second.presentation).toBe(result.presentation);
    expect(second.attachedLocations).toEqual([]);
  });

  it("discovers every target in deterministic owner order and applies exact compatibility", () => {
    const presentation = documentWithTargets();
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "code-style")).toEqual([{ source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "code" }]);
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "terminal-style")).toEqual([{ source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "terminal" }]);
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "simple-style")).toEqual([{ source: "slide", target: { kind: "slide", slideIndex: 0 }, elementId: "simple" }]);
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "structured-style")).toEqual([{ source: "root-definition", target: { kind: "root-definition", rootDefinitionId: "root-definition" }, elementId: "structured" }]);
    expect(findMatchingTargetElementsForLinkedStyle(presentation, "divider-style")).toEqual([{ source: "slide-local-root", target: { kind: "slide", slideIndex: 1 }, targetContainerId: "root", elementId: "divider" }]);
  });

  it("matches authored target leaves with exact persisted equality and independent local extras", () => {
    const gradient = { type: "linear", stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] };
    const border = { width: 1, style: "solid", color: "#222222" };
    const shadow = { x: 0, y: 2, blur: 4, color: "#000000" };
    const document = PresentationSchema.parse({
      schemaVersion: 1,
      id: "semantics",
      title: "Semantics",
      linkedStyles: [
        { target: "code", id: "code", name: "Code", layout: { width: 16 }, style: { background: { color: "#111111" }, border }, effect: { opacity: 0, shadow } },
        { target: "terminal", id: "terminal", name: "Terminal", typography: { fontSize: 14 }, titleTypography: { fontSize: 18 }, effect: { shadow } },
        { target: "table", mode: "simple", id: "simple", name: "Simple", effect: { opacity: 0 } },
        { target: "table", mode: "structured", id: "structured", name: "Structured", style: { dividerOpacity: 0 } },
        { target: "divider", id: "divider", name: "Divider", style: { background: { gradient } } },
      ],
      slides: [{ id: "slide", title: "Slide", elements: [
        { id: "code-match", type: "code", hidden: false, code: "x", language: "ts", layout: { width: 16 }, style: { background: { color: "#111111", gradient }, border, className: "keep" }, effect: { opacity: 0, shadow } },
        { id: "code-length-string", type: "code", hidden: false, code: "x", language: "ts", layout: { width: "16px" }, style: { background: { color: "#111111" }, border }, effect: { opacity: 0, shadow } },
        { id: "terminal-match", type: "terminal", hidden: false, lines: [], title: "Shell", titleStyle: { color: "#abc" }, typography: { fontSize: 14 }, titleTypography: { fontSize: 18 }, effect: { shadow } },
        { id: "terminal-missing-title", type: "terminal", hidden: false, lines: [], title: "Shell", typography: { fontSize: 14 }, effect: { shadow } },
        { id: "simple-omitted", type: "table", hidden: false, columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ada" }], effect: { opacity: 0 } },
        { id: "simple-structured", type: "table", mode: "structured", hidden: false, showHeader: false, columns: [{ id: "c", header: { id: "h", children: [] } }], rows: [{ id: "r", cells: [{ id: "cell", children: [] }] }], effect: { opacity: 0 } },
        { id: "structured-match", type: "table", mode: "structured", hidden: false, showHeader: false, columns: [{ id: "c2", header: { id: "h2", children: [] } }], rows: [{ id: "r2", cells: [{ id: "cell2", children: [] }] }], style: { dividerOpacity: 0 } },
        { id: "structured-omitted", type: "table", hidden: false, columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ada" }] },
        { id: "divider-match", type: "divider", hidden: false, orientation: "vertical", style: { background: { gradient } } },
        { id: "divider-different-gradient", type: "divider", hidden: false, orientation: "horizontal", style: { background: { gradient: { ...gradient, stops: [{ color: "#000000", position: 0 }, { color: "#eeeeee", position: 1 }] } } } },
      ] }],
    });
    expect(findMatchingTargetElementsForLinkedStyle(document, "code").map((location) => location.elementId)).toEqual(["code-match"]);
    expect(findMatchingTargetElementsForLinkedStyle(document, "terminal").map((location) => location.elementId)).toEqual(["terminal-match"]);
    expect(findMatchingTargetElementsForLinkedStyle(document, "simple").map((location) => location.elementId)).toEqual(["simple-omitted"]);
    expect(findMatchingTargetElementsForLinkedStyle(document, "structured").map((location) => location.elementId)).toEqual(["structured-match"]);
    expect(findMatchingTargetElementsForLinkedStyle(document, "divider").map((location) => location.elementId)).toEqual(["divider-match"]);
  });

  it("dispatches every target attach primitive and preserves effective values and local structure", () => {
    const initial = documentWithTargets();
    const before = structuredClone(initial);
    const codeBefore = findElement(initial.slides[0]!.elements, "code")!;
    const terminalBefore = findElement(initial.slides[0]!.elements, "terminal")!;
    const simpleBefore = findElement(initial.slides[0]!.elements, "simple")!;
    const structuredBefore = initial.rootDefinitions![0]!.root.children[0]!;
    const dividerBefore = initial.slides[1]!.localRootChildren![0]!.children[0]!;
    if (codeBefore.type !== "code" || terminalBefore.type !== "terminal" || simpleBefore.type !== "table" || structuredBefore.type !== "table" || structuredBefore.mode !== "structured" || dividerBefore.type !== "divider") throw new Error("Expected target fixtures");
    const codeEffective = resolveLinkedCodeStyle(initial, { ...codeBefore, linkedStyleId: "code-style" });
    const terminalEffective = resolveLinkedTerminalStyle(initial, { ...terminalBefore, linkedStyleId: "terminal-style" });
    const simpleEffective = resolveLinkedTableStyle(initial, { ...simpleBefore, linkedStyleId: "simple-style" });
    const structuredEffective = resolveLinkedTableStyle(initial, { ...structuredBefore, linkedStyleId: "structured-style" });
    const dividerEffective = resolveLinkedDividerStyle(initial, { ...dividerBefore, linkedStyleId: "divider-style" });
    const codeResult = attachTargetLinkedStyleToMatchingElements(initial, "code-style").presentation;
    const terminalResult = attachTargetLinkedStyleToMatchingElements(codeResult, "terminal-style").presentation;
    const simpleResult = attachTargetLinkedStyleToMatchingElements(terminalResult, "simple-style").presentation;
    const structuredResult = attachTargetLinkedStyleToMatchingElements(simpleResult, "structured-style").presentation;
    const result = attachTargetLinkedStyleToMatchingElements(structuredResult, "divider-style").presentation;
    const codeAfter = findElement(result.slides[0]!.elements, "code")!;
    const terminalAfter = findElement(result.slides[0]!.elements, "terminal")!;
    const simpleAfter = findElement(result.slides[0]!.elements, "simple")!;
    const structuredAfter = result.rootDefinitions![0]!.root.children[0]!;
    const dividerAfter = result.slides[1]!.localRootChildren![0]!.children[0]!;
    if (codeAfter.type !== "code" || terminalAfter.type !== "terminal" || simpleAfter.type !== "table" || structuredAfter.type !== "table" || structuredAfter.mode !== "structured" || dividerAfter.type !== "divider") throw new Error("Expected attached targets");
    expect(codeAfter).toMatchObject({ linkedStyleId: "code-style", style: { className: "keep" } });
    expect(terminalAfter).toMatchObject({ linkedStyleId: "terminal-style", titleStyle: { color: "#111111" } });
    expect(simpleAfter).toMatchObject({ linkedStyleId: "simple-style", columns: simpleBefore.columns, rows: simpleBefore.rows });
    expect(structuredAfter).toMatchObject({ linkedStyleId: "structured-style", columns: structuredBefore.columns, rows: structuredBefore.rows, showHeader: structuredBefore.showHeader });
    expect(resolveLinkedTerminalStyle(structuredResult, terminalAfter)).toEqual(terminalEffective);
    expect(resolveLinkedTableStyle(structuredResult, simpleAfter)).toEqual(simpleEffective);
    expect(resolveLinkedTableStyle(structuredResult, structuredAfter)).toEqual(structuredEffective);
    expect(resolveLinkedCodeStyle(result, codeAfter)).toEqual(codeEffective);
    expect(resolveLinkedDividerStyle(result, dividerAfter)).toEqual(dividerEffective);
    expect(result.linkedStyles).toEqual(before.linkedStyles);
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
