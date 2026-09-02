import { describe, expect, it } from "vitest";

import type { BlockItem, BlockPart, BlocksElement } from "@powershow/document-schema";

import {
  BLOCK_CONNECTOR_HEIGHT,
  BLOCK_CONNECTOR_WIDTH,
  BLOCK_STACK_OVERLAP,
  SCOPE_CLOSING_WIDTH,
  SCOPE_INDENT,
  renderBlocks,
} from "../src/render-blocks";

const text = (id: string, value = id): BlockPart => ({ id, type: "text", text: value });
const literal = (id: string, value: string): BlockPart => ({ id, type: "socket", content: { type: "literal", value } });
const empty = (id: string): BlockPart => ({ id, type: "socket", content: { type: "empty" } });
const value = (id: string, color = "#22c55e", parts: BlockPart[] = [text(`${id}-part`, "value")]): BlockItem => ({ id, color, shape: "value", parts, children: [] });
const statement = (id: string, color = "#22c55e", parts: BlockPart[] = [text(`${id}-part`, id)]): BlockItem => ({ id, color, shape: "statement", parts, children: [] });
const scope = (id = "scope"): BlockItem => ({ id, color: "#ef4444", shape: "scope", parts: [text(`${id}-part`, "repeat")], children: [statement(`${id}-child`)] });
const element = (items: BlockItem[] = [statement("one")], style?: BlocksElement["style"]): BlocksElement => ({ id: "blocks", type: "blocks", hidden: false, style, items });

describe("renderBlocks", () => {
  it("returns empty output for hidden Blocks", () => expect(renderBlocks({ ...element(), hidden: true })).toBe(""));

  it("preserves the canonical root contract and keeps inner blocks renderer-owned", () => {
    const html = renderBlocks(element([statement("one")], { background: { color: "#111827" } }));
    expect(html).toContain('class="powershow-element powershow-blocks"');
    expect(html).toContain('data-powershow-id="blocks"');
    expect(html).toContain('data-powershow-type="blocks"');
    expect(html).toContain('style="background:#111827"');
    expect(html).not.toContain('data-powershow-id="one"');
  });

  it("resolves direct block colors independently", () => {
    const html = renderBlocks(element([statement("red", "#ef4444"), statement("green", "#22c55e") ]));
    expect(html).toContain("background-color:#ef4444");
    expect(html).toContain("background-color:#22c55e");
  });

  it("emits real statement top-notch and bottom-bump geometry", () => {
    const html = renderBlocks(element([statement("s") , statement("next") ]));
    expect(html).toContain("powershow-block--statement");
    expect(html).toContain(`width:${BLOCK_CONNECTOR_WIDTH}px`);
    expect(html).toContain(`height:${BLOCK_CONNECTOR_HEIGHT}px`);
    expect(html).toContain("powershow-block-connector--top");
    expect(html).toContain("powershow-block-connector--bottom");
    expect(html).toContain("clip-path:polygon");
    expect(html).toContain(`margin-bottom:-${BLOCK_STACK_OVERLAP}px`);
    expect(html).toContain("gap:0");
  });

  it("renders parts inline and escapes text/literals", () => {
    const html = renderBlocks(element([statement("parts", "motion", [text("t", "<script>alert(1)</script>"), literal("l", "<literal>"), empty("e")])]));
    expect(html).toContain("display:inline-flex");
    expect(html).toContain("align-items:center");
    expect(html).toContain("powershow-block-socket--empty");
    expect(html).toContain("min-width:34px");
    expect(html).toContain("powershow-block-socket--literal");
    expect(html).toContain("background:rgba(255,255,255,.88)");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;literal&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("renders values as distinct reporter pills without stack connectors", () => {
    const html = renderBlocks(element([value("v") ]));
    expect(html).toContain("powershow-block--value");
    expect(html).toContain("display:inline-flex");
    expect(html).toContain("border-radius:999px");
    expect(html).not.toContain("powershow-block-connector");
  });

  it("keeps nested value blocks inline inside sockets, not stack siblings", () => {
    const html = renderBlocks(element([statement("parent", "motion", [{ id: "socket", type: "socket", content: { type: "block", block: value("nested") } }]), statement("sibling") ]));
    expect(html).toContain("powershow-block-socket--block");
    expect(html).toContain('data-powershow-block-id="nested"');
    expect(html).toContain("padding:0;background:transparent");
    expect(html.match(/data-powershow-block-id="/g)?.length).toBe(3);
  });

  it("lets statement parts wrap instead of forcing a nowrap row", () => {
    const html = renderBlocks(element([statement("wrap", "motion", [
      text("t1", "repeat"),
      literal("l1", "10"),
      text("t2", "times"),
      literal("l2", "100"),
      text("t3", "using long value"),
    ])]));
    expect(html).toContain("flex-wrap:wrap");
    expect(html).toContain("white-space:normal");
    expect(html).not.toContain("white-space:nowrap");
    expect(html).not.toContain("overflow:hidden");
  });

  it("keeps a nested value a socket child and not a stack sibling when parts wrap", () => {
    const html = renderBlocks(element([statement("parent", "motion", [
      text("t1", "set"),
      text("t2", "x"),
      literal("l1", "to"),
      { id: "socket", type: "socket", content: { type: "block", block: value("nested", "#22c55e", [text("v1", "long"), text("v2", "expression")]) } },
      text("t3", "and"),
      literal("l2", "another"),
    ]), statement("sibling") ]));
    expect(html).toContain("flex-wrap:wrap");
    expect(html).toContain("powershow-block-socket--block");
    const region = html.match(/powershow-block-socket--block[\s\S]*?data-powershow-block-id="nested"/);
    expect(region).not.toBeNull();
    expect(region?.[0]).not.toContain("sibling");
    expect(html.match(/data-powershow-block-id="/g)?.length).toBe(3);
  });

  it("renders a true open C-scope with rail, nested stack, and fixed footer", () => {
    const html = renderBlocks(element([scope("loop") ]));
    expect(html).toContain("powershow-block--scope");
    expect(html).toContain("powershow-block-header");
    expect(html).toContain("powershow-block-scope-body");
    expect(html).toContain("border-inline-start:4px solid #ef4444");
    expect(html).toContain("background:transparent");
    expect(html).toContain("powershow-block-scope-stack");
    expect(html).toContain(`margin-inline-start:${SCOPE_INDENT}px`);
    expect(html).toContain("powershow-block-scope-footer");
    expect(html).toContain(`width:${SCOPE_CLOSING_WIDTH}px`);
    expect(html).toContain("powershow-block-connector--bottom");
    expect(html).toContain('data-powershow-block-id="loop-child"');
    expect(html).not.toMatch(/powershow-block--scope[^>]*background-color:/);
  });

  it("applies the same wrapping contract to scope headers while preserving C-scope geometry", () => {
    const html = renderBlocks(element([scope("loop") ]));
    const partsOccurrences = html.match(/flex-wrap:wrap/g)?.length ?? 0;
    expect(partsOccurrences).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain("white-space:nowrap");
    expect(html).toContain("powershow-block-scope-body");
    expect(html).toContain("powershow-block-scope-footer");
    expect(html).toContain(`margin-inline-start:${SCOPE_INDENT}px`);
    expect(html).toContain(`width:${SCOPE_CLOSING_WIDTH}px`);
    expect(html).toContain("powershow-block-connector--top");
    expect(html).toContain("powershow-block-connector--bottom");
  });

  it("marks every BlockItem, including socket values, without scripts or runtime", () => {
    const html = renderBlocks(element([scope("all") ]));
    expect(html).toContain('data-powershow-block-id="all"');
    expect(html).toContain('data-powershow-block-id="all-child"');
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/on[a-z]+=/i);
    expect(html).not.toContain("eval(");
    expect(html).not.toContain("Function(");
    expect(html).not.toContain("Blockly");
    expect(html).not.toContain("runtime");
  });
});
