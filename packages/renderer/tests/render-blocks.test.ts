import { describe, expect, it } from "vitest";
import { renderBlocks } from "../src/render-blocks";
import type { BlockItem, BlockPart, BlocksElement } from "@powershow/document-schema";

const block = (id: string, shape: "statement" | "value" | "scope", parts: BlockPart[] = [{ id: `${id}-p`, type: "text", text: id }], children: BlockItem[] = []) => ({ id, categoryId: "a", shape, parts, children });
const element = (items: BlocksElement["items"] = [block("one", "statement")]): BlocksElement => ({ id: "blocks", type: "blocks", hidden: false, categories: [{ id: "a", name: "A", color: "#123456" }, { id: "b", name: "B", color: "#abcdef" }], items });

describe("renderBlocks", () => {
  it("renders static mBlock-like semantic geometry and escapes authored strings", () => {
    const html = renderBlocks(element([block("s", "statement", [{ id: "p", type: "text", text: "<script>alert(1)</script>" }, { id: "l", type: "socket", content: { type: "literal", value: "<x>" } }, { id: "e", type: "socket", content: { type: "empty" } }])]));
    expect(html).toContain("powershow-element powershow-blocks");
    expect(html).toContain('data-powershow-id="blocks"');
    expect(html).toContain('data-powershow-type="blocks"');
    expect(html).toContain('data-powershow-block-id="s"');
    expect(html).toContain("powershow-block--statement");
    expect(html).toContain("powershow-block-connector");
    expect(html).toContain("#123456");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("powershow-block-socket--literal");
    expect(html).toContain("powershow-block-socket--empty");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("gap:8px");
    expect(html).toContain("--powershow-stack-overlap:4px");
  });

  it("renders values inside sockets and scopes with a separate fixed footer", () => {
    const value = block("v", "value", [{ id: "vp", type: "text", text: "touching?" }]);
    const scope = block("scope", "scope", [{ id: "sp", type: "text", text: "repeat" }], [block("child", "statement" )]);
    const html = renderBlocks(element([{ ...block("root", "statement", [{ id: "p", type: "socket", content: { type: "block", block: value } }]) }, scope]));
    expect(html).toContain("powershow-block--value");
    expect(html).toContain('data-powershow-block-id="v"');
    expect(html).toContain("powershow-block-scope-body");
    expect(html).toContain("powershow-block-scope-stack");
    expect(html).toContain("powershow-block-scope-footer");
    expect(html).toContain("width:72px");
    expect(html).not.toContain('data-powershow-id="v"');
    expect(renderBlocks({ ...element(), hidden: true })).toBe("");
  });
});
