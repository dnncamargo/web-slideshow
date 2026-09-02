import { describe, expect, it } from "vitest";
import type { BlocksElement, CodeElement, SimpleTableElement, TableElement, TerminalElement } from "@powershow/document-schema";
import { renderElement } from "../src/render-element";
import { createCodeElement, createTableElement, createTerminalElement } from "./fixtures/render-fixtures";

const gradient = { type: "linear" as const, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] };
const canonicalStyle = { background: { color: "#101218", gradient }, border: { width: 1, style: "solid" as const, gradient }, borderRadius: 8, className: "data-root" };
const effect = { opacity: 0.5, shadow: { x: 0, y: 4, blur: 12, spread: 2, color: "#000000" } };
const layout = { width: 320, height: 180, position: "absolute" as const, top: 10, right: 20, bottom: 30, left: 40 };

function expectRootStyle(html: string): void {
  expect(html).toContain("width:320px");
  expect(html).toContain("height:180px");
  expect(html).toContain("position:absolute");
  expect(html).toContain("top:10px");
  expect(html).toContain("right:20px");
  expect(html).toContain("background:#101218");
  expect(html).toContain("background-image:linear-gradient");
  expect(html).toContain("border-image:linear-gradient");
  expect(html).toContain("border-radius:8px");
  expect(html).toContain("opacity:0.5");
  expect(html).toContain("box-shadow:0px 4px 12px 2px #000000");
  expect(html).toContain("data-root");
}

describe("canonical data root rendering", () => {
  it.each([
    ["code", createCodeElement({ layout, style: canonicalStyle, effect } as Partial<CodeElement>)],
    ["terminal", createTerminalElement({ layout, style: canonicalStyle, effect } as Partial<TerminalElement>)],
    ["table", createTableElement({ layout, style: canonicalStyle, effect } as Partial<SimpleTableElement>)],
    ["blocks", { id: "blocks", type: "blocks", hidden: false, layout, style: { color: "#f00", ...canonicalStyle }, effect, items: [{ id: "root", color: "#22c55e", shape: "statement", parts: [], children: [] }] } satisfies BlocksElement],
  ] as const)("renders canonical root style for %s", (_name, element) => {
    expectRootStyle(renderElement(element));
  });

  it("keeps structured ContentSlot style on the slot while the table root is canonical", () => {
    const table: TableElement = {
      id: "structured",
      type: "table",
      mode: "structured",
      showHeader: true,
      hidden: false,
      style: { background: { color: "#101218" } },
      columns: [{ id: "column", width: 120, header: { id: "header", style: { color: "#fff" }, children: [] } }],
      rows: [{ id: "row", cells: [{ id: "cell", style: { color: "#0f0" }, children: [] }] }],
    };
    const html = renderElement(table);
    expect(html).toContain('style="background:#101218"');
    expect(html).toContain('style="color:#fff"');
    expect(html).toContain('style="color:#0f0"');
  });

  it("recognizes all four canonical data children as absolute container children", () => {
    const children = [
      createCodeElement({ id: "code", layout: { position: "absolute", left: 1 } }),
      createTerminalElement({ id: "terminal", layout: { position: "absolute", left: 1 } }),
      createTableElement({ id: "table", layout: { position: "absolute", left: 1 } }),
      { id: "blocks", type: "blocks" as const, hidden: false, layout: { position: "absolute" as const, left: 1 }, items: [] },
    ];
    const html = renderElement({ id: "container", type: "container", hidden: false, children });
    expect(html).toContain("position:relative");
  });
});
