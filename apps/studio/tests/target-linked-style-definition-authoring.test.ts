import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import {
  changedTargetLinkedStyleProperties,
  clearLinkedTargetStyleProperty,
  propagateTargetLinkedStyleDefinitionChanges,
  updateTargetLinkedStyleDefinition,
  type TargetLinkedStyle,
} from "../src/features/editor/target-linked-style-definition-authoring";

function basePresentation(elements: object[], linkedStyles: object[]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    slides: [{ id: "slide", title: "", elements }],
    linkedStyles,
  });
}

function code(id: string, extra: object = {}): object {
  return { id, type: "code", hidden: false, code: "const answer = 42", language: "ts", linkedStyleId: "code-style", ...extra };
}

describe("target linked-style definition authoring", () => {
  it("updates Code definitions and clears only the changed local property", () => {
    const presentation = basePresentation([code("code", { style: { className: "local", borderRadius: 4 }, typography: { fontSize: 12, lineHeight: 1.5 } })], [
      { target: "code", id: "code-style", name: "Code", typography: { fontSize: 16 }, style: { color: "#111111" } },
    ]);
    const before = presentation.linkedStyles![0] as TargetLinkedStyle;
    const updated = updateTargetLinkedStyleDefinition(presentation, "code-style", { target: "code", typography: { fontSize: 20 } });
    const after = updated.linkedStyles![0] as TargetLinkedStyle;
    const propagated = propagateTargetLinkedStyleDefinitionChanges(updated, "code-style", before, after);
    expect(propagated.slides[0]!.elements[0]).toMatchObject({ style: { className: "local", borderRadius: 4 }, typography: { lineHeight: 1.5 } });
    expect(propagated.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(propagated.slides[0]!.elements[0]).toHaveProperty("code", "const answer = 42");
  });

  it("keeps Terminal typography, title typography, and palette members independent", () => {
    const presentation = basePresentation([{ id: "terminal", type: "terminal", hidden: false, lines: [], linkedStyleId: "terminal-style", typography: { fontSize: 11, lineHeight: 1.2 }, titleTypography: { fontSize: 10, fontFamily: "monospace" }, style: { outputColor: "#222222", promptColor: "#333333", className: "local" } }], [
      { target: "terminal", id: "terminal-style", name: "Terminal", typography: { fontSize: 14 }, titleTypography: { fontSize: 16 }, style: { outputColor: "#444444", promptColor: "#555555" } },
    ]);
    const before = presentation.linkedStyles![0] as TargetLinkedStyle;
    const updated = updateTargetLinkedStyleDefinition(presentation, "terminal-style", { target: "terminal", typography: { fontSize: 15 } });
    const after = updated.linkedStyles![0] as TargetLinkedStyle;
    const result = propagateTargetLinkedStyleDefinitionChanges(updated, "terminal-style", before, after);
    expect(result.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(result.slides[0]!.elements[0]).toMatchObject({ typography: { lineHeight: 1.2 }, titleTypography: { fontSize: 10, fontFamily: "monospace" }, style: { outputColor: "#222222", promptColor: "#333333", className: "local" } });
  });

  it("supports Simple and Structured tables without crossing modes", () => {
    const simple = { id: "simple", type: "table", hidden: false, columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ada" }], linkedStyleId: "simple-style", style: { color: "#111111", className: "simple" }, typography: { fontSize: 12 } };
    const structured = { id: "structured", type: "table", mode: "structured", hidden: false, columns: [{ id: "name", header: { id: "header", children: [] }, width: 120 }], rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }], linkedStyleId: "structured-style", style: { headerBackground: "#111111", bodyRowAlternateBackground: "#222222", dividerOpacity: 0.5, className: "structured" } };
    const presentation = basePresentation([simple, structured], [
      { target: "table", mode: "simple", id: "simple-style", name: "Simple", typography: { fontSize: 16 } },
      { target: "table", mode: "structured", id: "structured-style", name: "Structured", style: { headerBackground: "#333333", bodyRowAlternateBackground: "#444444", dividerOpacity: 0.8 } },
    ]);
    const beforeSimple = presentation.linkedStyles![0] as TargetLinkedStyle;
    const changedSimple = updateTargetLinkedStyleDefinition(presentation, "simple-style", { target: "table", mode: "simple", typography: { fontSize: 18 } });
    const simpleResult = propagateTargetLinkedStyleDefinitionChanges(changedSimple, "simple-style", beforeSimple, changedSimple.linkedStyles![0] as TargetLinkedStyle);
    expect(simpleResult.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(simpleResult.slides[0]!.elements[0]).not.toHaveProperty("mode");
    expect(simpleResult.slides[0]!.elements[1]).toMatchObject({ style: { headerBackground: "#111111", bodyRowAlternateBackground: "#222222", dividerOpacity: 0.5 } });
  });

  it("preserves the other background member and handles falsey values", () => {
    const before = { target: "code" as const, id: "code-style", name: "Code", style: { background: { color: "#111111", gradient: { type: "linear" as const, angle: 90, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] } } }, effect: { opacity: 0 } };
    const element = code("code", { linkedStyleId: "code-style", style: { background: { color: "#aaaaaa", gradient: before.style.background.gradient }, className: "local" }, effect: { opacity: 0, shadow: { x: 1, y: 1, blur: 2, color: "#000000" } } });
    const presentation = basePresentation([element], [before]);
    const changed = { ...before, style: { background: { color: "#222222", gradient: before.style.background.gradient } }, effect: { opacity: 0.5 } };
    expect(changedTargetLinkedStyleProperties(before, changed)).toEqual(["style.background.color", "effect.opacity"]);
    const cleared = clearLinkedTargetStyleProperty(presentation.slides[0]!.elements[0] as never, "style.background.color");
    expect(cleared).toMatchObject({ style: { background: { gradient: before.style.background.gradient }, className: "local" } });
  });

  it("clears add, change, and remove transitions without materializing removed values", () => {
    const presentation = basePresentation([code("code", { typography: { fontSize: 12, lineHeight: 1.4 } })], [
      { target: "code", id: "code-style", name: "Code", style: { color: "#111111" }, typography: { fontSize: 16 } },
    ]);
    const initial = presentation.linkedStyles![0] as TargetLinkedStyle;
    const added = updateTargetLinkedStyleDefinition(presentation, "code-style", { target: "code", typography: { letterSpacing: 2 } });
    const changed = updateTargetLinkedStyleDefinition(added, "code-style", { target: "code", typography: { fontSize: 20 } });
    const removed = updateTargetLinkedStyleDefinition(changed, "code-style", { target: "code", typography: { fontSize: undefined } });
    expect(changedTargetLinkedStyleProperties(initial, added.linkedStyles![0] as TargetLinkedStyle)).toEqual(["typography.letterSpacing"]);
    expect(changedTargetLinkedStyleProperties(added.linkedStyles![0] as TargetLinkedStyle, changed.linkedStyles![0] as TargetLinkedStyle)).toEqual(["typography.fontSize"]);
    expect(changedTargetLinkedStyleProperties(changed.linkedStyles![0] as TargetLinkedStyle, removed.linkedStyles![0] as TargetLinkedStyle)).toEqual(["typography.fontSize"]);
    const result = propagateTargetLinkedStyleDefinitionChanges(removed, "code-style", changed.linkedStyles![0] as TargetLinkedStyle, removed.linkedStyles![0] as TargetLinkedStyle);
    expect(result.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(result.slides[0]!.elements[0]).toMatchObject({ typography: { lineHeight: 1.4 } });
    expect(result.slides[0]!.elements[0]).not.toHaveProperty("typography.letterSpacing");
  });

  it("covers the Divider matrix and Structured Table zero-valued ownership", () => {
    const divider = { target: "divider" as const, id: "divider-style", name: "Divider", layout: { position: "absolute" as const, width: 10 }, style: { background: { color: "#111111", gradient: { type: "linear" as const, angle: 0, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] } }, borderRadius: 2 }, effect: { opacity: 0 } };
    const changedDivider = { ...divider, layout: { ...divider.layout, width: 20 }, style: { ...divider.style, background: { ...divider.style.background, color: "#222222" } }, effect: { opacity: 0.5 } };
    expect(changedTargetLinkedStyleProperties(divider, changedDivider)).toEqual(["layout.width", "style.background.color", "effect.opacity"]);
    const dividerPresentation = basePresentation([{ id: "divider", type: "divider", hidden: false, orientation: "vertical", linkedStyleId: "divider-style", layout: { position: "absolute", width: 8 }, style: { background: { color: "#aaaaaa", gradient: divider.style.background.gradient }, borderRadius: 4, className: "local" }, effect: { opacity: 0.2 } }], [divider]);
    const dividerCleared = clearLinkedTargetStyleProperty(dividerPresentation.slides[0]!.elements[0] as never, "style.background.color");
    expect(dividerCleared).toMatchObject({ orientation: "vertical", style: { background: { gradient: divider.style.background.gradient }, borderRadius: 4, className: "local" } });
    const structured = { target: "table" as const, mode: "structured" as const, id: "structured-style", name: "Structured", style: { dividerOpacity: 0 } };
    const structuredAfter = { ...structured, style: { dividerOpacity: 0.5 } };
    expect(changedTargetLinkedStyleProperties(structured, structuredAfter)).toEqual(["style.dividerOpacity"]);
  });

  it("returns the original presentation for no-op, invalid, missing, and incompatible updates", () => {
    const presentation = basePresentation([code("code")], [{ target: "code", id: "code-style", name: "Code", style: { color: "#111111" } }]);
    expect(updateTargetLinkedStyleDefinition(presentation, "code-style", { target: "code", style: { color: "#111111" } })).toBe(presentation);
    expect(updateTargetLinkedStyleDefinition(presentation, "missing", { target: "code", style: { color: "#222222" } })).toBe(presentation);
    expect(updateTargetLinkedStyleDefinition(presentation, "code-style", { target: "terminal", style: { outputColor: "#222222" } })).toBe(presentation);
    expect(updateTargetLinkedStyleDefinition(presentation, "code-style", { target: "table", mode: "simple", style: { color: "#222222" } })).toBe(presentation);
  });

  it("propagates through Slide, Root Definition, and localRootChildren ownership trees", () => {
    const linked = { target: "code" as const, id: "code-style", name: "Code", typography: { fontSize: 16 } };
    const consumer = (id: string) => code(id, { typography: { fontSize: 12, lineHeight: 1.4 } });
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "owners",
      title: "Owners",
      slides: [{ id: "slide", title: "", elements: [consumer("slide-code")] }, { id: "root-slide", title: "", rootDefinitionId: "root", elements: [], localRootChildren: [{ targetContainerId: "root-content", children: [consumer("local-code")] }] }],
      rootDefinitions: [{ id: "root", name: "Root", root: { id: "root-container", type: "container", hidden: false, children: [{ id: "root-content", type: "container", hidden: false, children: [consumer("root-code")] }] }, localChildTargetIds: ["root-content"] }],
      linkedStyles: [linked],
    });
    const before = linked as TargetLinkedStyle;
    const updated = updateTargetLinkedStyleDefinition(presentation, "code-style", { target: "code", typography: { fontSize: 20 } });
    const result = propagateTargetLinkedStyleDefinitionChanges(updated, "code-style", before, updated.linkedStyles![0] as TargetLinkedStyle);
    expect(result.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(result.slides[1]!.localRootChildren![0]!.children[0]).not.toHaveProperty("typography.fontSize");
    expect(result.rootDefinitions![0]!.root.children[0]).toMatchObject({ children: [{ id: "root-code", linkedStyleId: "code-style", typography: { lineHeight: 1.4 } }] });
  });
});
