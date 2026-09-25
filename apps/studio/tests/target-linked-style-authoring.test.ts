import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import {
  attachLinkedCodeStyleToElement,
  attachLinkedDividerStyleToElement,
  attachLinkedTableStyleToElement,
  attachLinkedTerminalStyleToElement,
  canCreateLinkedStyleFromCode,
  createLinkedStyleFromCodeElement,
  createLinkedStyleFromDividerElement,
  createLinkedStyleFromSimpleTableElement,
  createLinkedStyleFromStructuredTableElement,
  createLinkedStyleFromTerminalElement,
  detachLinkedCodeStyleFromElement,
  detachLinkedDividerStyleFromElement,
  detachLinkedTableStyleFromElement,
  detachLinkedTerminalStyleFromElement,
} from "../src/features/editor/linked-style-authoring";

function presentation(element: object): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    slides: [{ id: "slide", title: "", elements: [element] }],
  });
}

describe("target linked-style authoring primitives", () => {
  it.each([
    ["code", createLinkedStyleFromCodeElement, { type: "code", code: "const x = 1", language: "ts", style: { color: "#123456", className: "local" }, layout: { width: 400 } }],
    ["terminal", createLinkedStyleFromTerminalElement, { type: "terminal", lines: [{ type: "output", content: "ready" }], title: "Shell", titleStyle: { color: "#654321" }, style: { outputColor: "#123456", className: "local" }, typography: { fontSize: 14 } }],
    ["simple table omitted", createLinkedStyleFromSimpleTableElement, { type: "table", columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ada" }], style: { color: "#123456", className: "local" }, typography: { fontSize: 14 } }],
    ["simple table", createLinkedStyleFromSimpleTableElement, { type: "table", mode: "simple", columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ada" }], style: { color: "#123456", className: "local" }, typography: { fontSize: 14 } }],
    ["structured table", createLinkedStyleFromStructuredTableElement, { type: "table", mode: "structured", columns: [{ id: "name", header: { id: "header", children: [] }, width: 120 }], rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }], style: { headerBackground: "#123456", className: "local" } }],
    ["divider", createLinkedStyleFromDividerElement, { type: "divider", orientation: "vertical", style: { background: { color: "#123456" }, className: "local" }, layout: { width: 2 } }],
  ])("creates a canonical %s definition and keeps className local", (_name, create, raw) => {
    const element = presentation({ id: "element", hidden: false, ...raw }).slides[0]!.elements[0]!;
    const result = create(presentation({ id: "element", hidden: false, ...raw }), element as never, "Shared");
    expect(result).not.toBeNull();
    expect(result!.presentation.linkedStyles).toHaveLength(1);
    expect(result!.presentation.linkedStyles![0]).not.toHaveProperty("style.className");
    expect(result!.element).toMatchObject({ linkedStyleId: "shared", style: { className: "local" } });
    if (String(_name).startsWith("simple table")) {
      expect(result!.presentation.linkedStyles![0]).toMatchObject({ target: "table", mode: "simple", typography: { fontSize: 14 } });
      expect(result!.element).not.toHaveProperty("typography");
      if (_name === "simple table omitted") expect(result!.element).not.toHaveProperty("mode");
    }
    expect(PresentationSchema.safeParse({ ...result!.presentation, slides: [{ id: "slide", title: "", elements: [result!.element] }] }).success).toBe(true);
  });

  it("adopts only destination ownership and detaches through the canonical resolver", () => {
    const local = presentation({ id: "code", type: "code", hidden: false, code: "x", style: { color: "#111111", className: "local" }, layout: { position: "absolute", left: 20 } }).slides[0]!.elements[0]!;
    if (local.type !== "code") throw new Error("Expected Code");
    const withStyle = { ...presentation(local), linkedStyles: [{ target: "code" as const, id: "shared", name: "Shared", style: { color: "#abcdef" }, layout: { position: "absolute" as const } }] };
    expect(canCreateLinkedStyleFromCode(local)).toBe(true);
    const attached = attachLinkedCodeStyleToElement(withStyle, local, "shared");
    expect(attached).toMatchObject({ linkedStyleId: "shared", layout: { position: "absolute", left: 20 }, style: { className: "local" } });
    const detached = detachLinkedCodeStyleFromElement(withStyle, attached!);
    expect(detached).toMatchObject({ style: { color: "#abcdef", className: "local" } });
    expect(detached).not.toHaveProperty("linkedStyleId");
    expect(PresentationSchema.safeParse({ ...withStyle, slides: [{ id: "slide", title: "", elements: [detached] }] }).success).toBe(true);
  });

  it("accepts omitted Simple mode, rejects wrong mode, and preserves source immutably", () => {
    const local = presentation({ id: "table", type: "table", hidden: false, columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ada" }], style: { background: { color: "#111111", gradient: { type: "linear", angle: 90, stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 1 }] } }, border: { width: 1, style: "solid", color: "#000" }, className: "local" }, typography: { fontSize: 12 }, effect: { opacity: 0 } }).slides[0]!.elements[0]!;
    if (local.type !== "table") throw new Error("Expected Table");
    const source = structuredClone(local);
    const withStyles: Presentation = PresentationSchema.parse({ ...presentation(local), linkedStyles: [
      { target: "table" as const, mode: "simple" as const, id: "simple", name: "Simple", style: { background: { color: "#abcdef" }, border: { width: 2, style: "solid", color: "#fff" } }, typography: { fontSize: 18 }, effect: { opacity: 0.5 } },
      { target: "table" as const, mode: "structured" as const, id: "structured", name: "Structured", effect: { opacity: 0.5 } },
    ] });
    expect(attachLinkedTableStyleToElement(withStyles, local, "structured")).toBeNull();
    const attached = attachLinkedTableStyleToElement(withStyles, local, "simple");
    expect(attached).toMatchObject({ linkedStyleId: "simple", style: { background: { gradient: local.style?.background?.gradient }, className: "local" } });
    expect(attached).not.toHaveProperty("typography");
    expect(local).toEqual(source);
    const detached = detachLinkedTableStyleFromElement(withStyles, attached!);
    expect(detached).toMatchObject({ style: { background: { color: "#abcdef", gradient: local.style?.background?.gradient }, className: "local" }, effect: { opacity: 0.5 } });
    expect(detached).not.toHaveProperty("linkedStyleId");
    expect(detached).not.toHaveProperty("mode");
  });

  it("handles Terminal title ownership and Divider position validity", () => {
    const terminal = presentation({ id: "terminal", type: "terminal", hidden: false, lines: [], title: "Shell", titleStyle: { color: "#111111" }, typography: { fontSize: 12 }, titleTypography: { fontSize: 10 }, style: { outputColor: "#111111", promptColor: "#222222", className: "terminal" } }).slides[0]!.elements[0]!;
    if (terminal.type !== "terminal") throw new Error("Expected Terminal");
    const terminalPresentation = { ...presentation(terminal), linkedStyles: [{ target: "terminal" as const, id: "terminal-style", name: "Terminal", typography: { fontSize: 16 }, titleTypography: { fontSize: 20 }, style: { outputColor: "#abcdef" } }] };
    const attachedTerminal = attachLinkedTerminalStyleToElement(terminalPresentation, terminal, "terminal-style")!;
    expect(attachedTerminal).not.toHaveProperty("typography");
    expect(attachedTerminal).not.toHaveProperty("titleTypography");
    expect(attachedTerminal).toMatchObject({ style: { promptColor: "#222222", className: "terminal" } });
    expect(attachedTerminal).toHaveProperty("titleStyle");
    expect(detachLinkedTerminalStyleFromElement(terminalPresentation, attachedTerminal)).toMatchObject({ typography: { fontSize: 16 }, titleTypography: { fontSize: 20 }, titleStyle: { color: "#111111" } });

    const divider = presentation({ id: "divider", type: "divider", hidden: false, layout: { position: "absolute", left: 20 }, style: { className: "divider" } }).slides[0]!.elements[0]!;
    if (divider.type !== "divider") throw new Error("Expected Divider");
    const dividerPresentation = { ...presentation(divider), linkedStyles: [{ target: "divider" as const, id: "divider-style", name: "Divider", layout: { position: "absolute" as const }, effect: { opacity: 0 } }] };
    const attachedDivider = attachLinkedDividerStyleToElement(dividerPresentation, divider, "divider-style")!;
    expect(attachedDivider).toMatchObject({ layout: { position: "absolute", left: 20 } });
    expect(detachLinkedDividerStyleFromElement(dividerPresentation, attachedDivider)).toMatchObject({ orientation: "horizontal", effect: { opacity: 0 } });
  });

  it("attaches and detaches a Structured Table without changing its structure", () => {
    const structured = presentation({
      id: "structured", type: "table", mode: "structured", hidden: false, showHeader: false,
      columns: [{ id: "name", header: { id: "header", children: [] }, width: 120 }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
      style: { background: { color: "#111111" }, headerBackground: "#222222", className: "structured" },
      effect: { opacity: 0.8 },
    }).slides[0]!.elements[0]!;
    if (structured.type !== "table" || structured.mode !== "structured") throw new Error("Expected Structured Table");
    const structureSnapshot = structuredClone(structured);
    const withStyles: Presentation = PresentationSchema.parse({ ...presentation(structured), linkedStyles: [
      { target: "table" as const, mode: "simple" as const, id: "simple", name: "Simple", style: { color: "#333333" } },
      { target: "table" as const, mode: "structured" as const, id: "structured-style", name: "Structured", layout: { width: 640 }, style: { background: { color: "#444444" }, headerBackground: "#555555", bodyRowAlternateBackground: "#666666", dividerOpacity: 0.4 }, effect: { opacity: 0.5 } },
    ] });
    expect(attachLinkedTableStyleToElement(withStyles, structured, "simple")).toBeNull();
    const attached = attachLinkedTableStyleToElement(withStyles, structured, "structured-style")!;
    expect(attached).toMatchObject({ linkedStyleId: "structured-style", showHeader: false, columns: structureSnapshot.columns, rows: structureSnapshot.rows, style: { className: "structured" } });
    expect(attached).not.toHaveProperty("style.headerBackground");
    expect(attached).not.toHaveProperty("effect.opacity");
    const detached = detachLinkedTableStyleFromElement(withStyles, attached)!;
    expect(detached).toMatchObject({ style: { background: { color: "#444444" }, headerBackground: "#555555", bodyRowAlternateBackground: "#666666", dividerOpacity: 0.4, className: "structured" }, effect: { opacity: 0.5 } });
    expect(detached).not.toHaveProperty("linkedStyleId");
    expect({ columns: detached.columns, rows: detached.rows, showHeader: structured.showHeader }).toEqual({ columns: structureSnapshot.columns, rows: structureSnapshot.rows, showHeader: structureSnapshot.showHeader });
    expect(PresentationSchema.safeParse({ ...withStyles, slides: [{ id: "slide", title: "", elements: [detached] }] }).success).toBe(true);
  });

  it("switches Code ownership without materializing the source style", () => {
    const code = presentation({ id: "code-switch", type: "code", hidden: false, code: "x", style: { color: "#101010", border: { width: 1, style: "solid", color: "#202020" }, className: "code" }, effect: { shadow: { x: 1, y: 1, blur: 2, color: "#303030" } } }).slides[0]!.elements[0]!;
    if (code.type !== "code") throw new Error("Expected Code");
    const withStyles: Presentation = PresentationSchema.parse({ ...presentation(code), slides: [{ id: "slide", title: "", elements: [{ ...code, linkedStyleId: "source" }] }], linkedStyles: [
      { target: "code" as const, id: "source", name: "Source", style: { color: "#404040" } },
      { target: "code" as const, id: "destination", name: "Destination", style: { border: { width: 4, style: "solid", color: "#505050" } }, effect: { shadow: { x: 2, y: 2, blur: 4, color: "#606060" } } },
    ] });
    const switched = attachLinkedCodeStyleToElement(withStyles, code, "destination")!;
    expect(switched).toMatchObject({ linkedStyleId: "destination", style: { color: "#101010", className: "code" } });
    expect(switched).not.toHaveProperty("style.border");
    expect(switched).not.toHaveProperty("effect.shadow");
    expect(switched).not.toHaveProperty("style.color", "#404040");
  });

  it("switches Simple, Structured and Divider styles while preserving local identity", () => {
    const simple = presentation({ id: "simple-switch", type: "table", columns: [{ key: "name", label: "Name" }], rows: [{ name: "Ada" }], style: { color: "#707070", className: "simple" } }).slides[0]!.elements[0]!;
    if (simple.type !== "table") throw new Error("Expected Table");
    const simplePresentation: Presentation = PresentationSchema.parse({ ...presentation(simple), slides: [{ id: "slide", title: "", elements: [{ ...simple, linkedStyleId: "simple-source" }] }], linkedStyles: [
      { target: "table" as const, mode: "simple" as const, id: "simple-source", name: "Source", style: { color: "#808080" } },
      { target: "table" as const, mode: "simple" as const, id: "simple-destination", name: "Destination", effect: { opacity: 0 } },
    ] });
    const simpleSwitch = attachLinkedTableStyleToElement(simplePresentation, simple, "simple-destination")!;
    expect(simpleSwitch).toMatchObject({ linkedStyleId: "simple-destination", style: { color: "#707070", className: "simple" } });
    expect(simpleSwitch).not.toHaveProperty("mode");
    expect(simpleSwitch).not.toHaveProperty("effect");

    const structured = presentation({ id: "structured-switch", type: "table", mode: "structured", hidden: false, columns: [{ id: "c", header: { id: "h", children: [] } }], rows: [{ id: "r", cells: [{ id: "cell", children: [] }] }], style: { headerBackground: "#909090", className: "structured" } }).slides[0]!.elements[0]!;
    if (structured.type !== "table" || structured.mode !== "structured") throw new Error("Expected Structured Table");
    const structuredPresentation: Presentation = PresentationSchema.parse({ ...presentation(structured), slides: [{ id: "slide", title: "", elements: [{ ...structured, linkedStyleId: "structured-source" }] }], linkedStyles: [
      { target: "table" as const, mode: "structured" as const, id: "structured-source", name: "Source", style: { headerBackground: "#a0a0a0" } },
      { target: "table" as const, mode: "structured" as const, id: "structured-destination", name: "Destination", style: { dividerOpacity: 0.3 } },
    ] });
    const structuredSwitch = attachLinkedTableStyleToElement(structuredPresentation, structured, "structured-destination")!;
    expect(structuredSwitch).toMatchObject({ linkedStyleId: "structured-destination", style: { headerBackground: "#909090", className: "structured" }, columns: structured.columns, rows: structured.rows });

    const divider = presentation({ id: "divider-switch", type: "divider", hidden: false, orientation: "vertical", style: { className: "divider" } }).slides[0]!.elements[0]!;
    if (divider.type !== "divider") throw new Error("Expected Divider");
    const dividerPresentation: Presentation = PresentationSchema.parse({ ...presentation(divider), slides: [{ id: "slide", title: "", elements: [{ ...divider, linkedStyleId: "divider-source" }] }], linkedStyles: [
      { target: "divider" as const, id: "divider-source", name: "Source", style: { background: { color: "#b0b0b0" } } },
      { target: "divider" as const, id: "divider-destination", name: "Destination", layout: { width: 4 }, effect: { opacity: 0 } },
    ] });
    const dividerSwitch = attachLinkedDividerStyleToElement(dividerPresentation, divider, "divider-destination")!;
    expect(dividerSwitch).toMatchObject({ linkedStyleId: "divider-destination", orientation: "vertical", style: { className: "divider" } });
    expect(dividerSwitch).not.toHaveProperty("effect");
  });
});
