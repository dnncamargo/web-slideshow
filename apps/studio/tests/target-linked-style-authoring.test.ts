import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import {
  attachLinkedCodeStyleToElement,
  canCreateLinkedStyleFromCode,
  createLinkedStyleFromCodeElement,
  createLinkedStyleFromDividerElement,
  createLinkedStyleFromSimpleTableElement,
  createLinkedStyleFromStructuredTableElement,
  createLinkedStyleFromTerminalElement,
  detachLinkedCodeStyleFromElement,
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
});
