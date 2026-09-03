import { describe, expect, it } from "vitest";
import { BlocksElementSchema } from "@powershow/document-schema";
import { renderBlocks } from "../src/render-blocks";
import { createDidacticBlocksElement } from "./fixtures/render-fixtures";

const region = (html: string, className: string): string => {
  const start = html.indexOf(`class="powershow-block powershow-block--${className}`);
  const next = html.indexOf('class="powershow-block powershow-block--', start + 10);
  return start < 0 ? "" : html.slice(start, next < 0 ? html.length : next);
};

describe("renderBlocks", () => {
  it("preserves the wrapper, custom class, and hidden behavior", () => {
    const element = { ...createDidacticBlocksElement(), style: { className: "custom-blocks" } };
    const html = renderBlocks(element);
    expect(html).toContain('class="powershow-element powershow-blocks custom-blocks"');
    expect(html).toContain('data-powershow-id="didactic-blocks"');
    expect(html).toContain('data-powershow-type="blocks"');
    expect(renderBlocks({ ...element, hidden: true })).toBe("");
  });

  it("renders all seven shapes from real grammar without exposing DSL source", () => {
    const element = { ...createDidacticBlocksElement(), source: String.raw`\start(Start)\statement(Text \value(10) \variable(score) \logic(yes))\scope(Loop){\statement(Child)}\end(End)` };
    const html = renderBlocks(element);
    for (const shape of ["start", "statement", "scope", "end", "value", "variable", "logic"]) {
      expect(html).toContain(`powershow-block--${shape}`);
    }
    expect(html).not.toContain("powershow-blocks-source");
    expect(html).not.toContain("\\statement(");
    expect(html).toContain("Text ");
    expect(html).toContain(">10</span>");
  });

  it("uses intrinsic nowrap sizing and simple connector topology", () => {
    const html = renderBlocks(createDidacticBlocksElement());
    expect(html).toContain("width:max-content");
    expect(html).toContain("white-space:nowrap");
    expect(html).not.toContain("flex-wrap:wrap");
    expect(html).not.toContain("overflow-wrap:anywhere");
    expect(html).not.toContain("white-space:pre-wrap");
    expect(region(html, "start")).toContain("powershow-block-connector--bottom");
    expect(html.match(/powershow-block-connector--bottom/g)?.length).toBe(8);
    expect(html.slice(html.indexOf('class="powershow-block powershow-block--end'), html.length)).not.toContain("powershow-block-connector");
    expect(html).toContain("powershow-block-start-arch");
  });

  it("renders scope children in authored order on the filled scope surface", () => {
    const html = renderBlocks(createDidacticBlocksElement());
    expect(html).toContain("powershow-block-scope-body");
    expect(html).toContain("powershow-block-scope-stack");
    expect(html.indexOf("Turn ")).toBeLessThan(html.indexOf("Set x to"));
    expect(html.indexOf("Move ")).toBeLessThan(html.indexOf("Turn "));
  });

  it("uses defaults and direct/palette color overrides", () => {
    const defaults = renderBlocks({ ...createDidacticBlocksElement(), style: undefined });
    expect(defaults).toContain("#4C97FF");
    expect(defaults).toContain("#FFAB19");
    expect(defaults).toContain("#59C059");
    const overridden = renderBlocks({ ...createDidacticBlocksElement(), style: { statementColor: "#123456", scopeColor: "#234567", logicColor: "#345678" } });
    expect(overridden).toContain("#123456");
    expect(overridden).toContain("#234567");
    expect(overridden).toContain("#345678");
  });

  it("escapes authored text and inline values without executable markup", () => {
    const html = renderBlocks({ ...createDidacticBlocksElement(), source: String.raw`\statement(<script>&<> \value(<img>) \variable(<b>))` });
    expect(html).toContain("&lt;script&gt;&amp;&lt;&gt;");
    expect(html).toContain("&lt;img&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });

  it("fails closed for invalid source and keeps an empty valid source empty", () => {
    const invalid = renderBlocks({ ...createDidacticBlocksElement(), source: "\\statement(" });
    expect(invalid).toContain('data-powershow-blocks-invalid="true"');
    expect(invalid).not.toContain("\\statement(");
    const empty = renderBlocks({ ...createDidacticBlocksElement(), source: " \n\t" });
    expect(empty).toContain("powershow-blocks-stack");
    expect(empty).not.toContain("powershow-blocks-invalid");
  });

  it("accepts the didactic fixture against the canonical schema", () => {
    expect(() => BlocksElementSchema.parse(createDidacticBlocksElement())).not.toThrow();
  });
});
