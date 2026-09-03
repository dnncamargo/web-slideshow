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

  it("renders the fixed category palette and semantic markers without changing shape", () => {
    const html = renderBlocks({
      ...createDidacticBlocksElement(),
      source: String.raw`\start[events](Start)\statement[motion](Move)\scope[looks](Look){\statement[sound](Sound)}\end[control](End)\statement[sensing](Sense)\statement[operators](Operate)\statement[variables](Set)\statement(Check \logic[control](Check))`,
    });
    const expected = {
      events: "#FFBF00", motion: "#4C97FF", looks: "#9966FF", sound: "#CF63CF",
      control: "#FFAB19", sensing: "#5CB1D6", operators: "#59C059", variables: "#FF8C1A",
    };
    for (const [category, color] of Object.entries(expected)) {
      expect(html).toContain(`data-powershow-block-category="${category}"`);
      expect(html).toContain(`background:${color}`);
    }
    expect(html).toContain("powershow-block--statement");
    expect(html).toContain("powershow-block--logic");
  });

  it("separates inline visual tokens without changing stack block geometry", () => {
    const html = renderBlocks({
      ...createDidacticBlocksElement(),
      source: String.raw`\statement(Repeat \value(10) \variable(score) \logic(> \value(5)))`,
    });

    for (const shape of ["value", "variable", "logic"]) {
      expect(region(html, shape)).toContain("margin-inline:5px");
    }
    expect(region(html, "statement")).not.toContain("margin-inline:5px");
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
    const scopeStart = html.indexOf('class="powershow-block powershow-block--scope"');
    const scopeBody = html.indexOf('class="powershow-block-scope-body"', scopeStart);
    expect(scopeStart).toBeGreaterThanOrEqual(0);
    expect(scopeBody).toBeGreaterThan(scopeStart);
    expect(html.slice(scopeStart, scopeBody)).toContain("display:inline-flex;align-items:center;width:max-content;white-space:nowrap;box-sizing:border-box;padding:7px 12px;border-radius:7px;position:relative;flex-direction:column;align-items:flex-start");
    expect(html.slice(scopeBody, html.indexOf('class="powershow-block-scope-stack"', scopeBody))).toContain("display:flex;flex-direction:column;align-items:flex-start;width:max-content;padding:6px 0 8px 14px;position:relative;z-index:1");
    expect(html.indexOf("Turn ")).toBeLessThan(html.indexOf("Set x to"));
    expect(html.indexOf("Move ")).toBeLessThan(html.indexOf("Turn "));
  });

  it("renders nested scopes inside the authored parent scope", () => {
    const html = renderBlocks({
      ...createDidacticBlocksElement(),
      source: String.raw`\scope(Outer){\statement(Before)\scope(Inner){\statement(Inside)}\statement(After)}`,
    });
    const outerStart = html.indexOf('class="powershow-block powershow-block--scope"');
    const outerBody = html.indexOf('class="powershow-block-scope-body"', outerStart);
    const innerStart = html.indexOf('class="powershow-block powershow-block--scope"', outerBody);

    expect(html.match(/powershow-block--scope/g)).toHaveLength(2);
    expect(outerStart).toBeGreaterThanOrEqual(0);
    expect(outerBody).toBeGreaterThan(outerStart);
    expect(innerStart).toBeGreaterThan(outerBody);
    expect(html.indexOf("Before")).toBeLessThan(innerStart);
    expect(innerStart).toBeLessThan(html.indexOf("Inside"));
    expect(html.indexOf("Inside")).toBeLessThan(html.indexOf("After"));
  });

  it("uses defaults and direct/palette color overrides", () => {
    const uncategorizedSource = String.raw`\start(Start)\statement(Statement)\scope(Scope){\statement(Child)}\statement(\logic(Logic))`;
    const defaults = renderBlocks({ ...createDidacticBlocksElement(), source: uncategorizedSource, style: undefined });
    expect(defaults).toContain("#4C97FF");
    expect(defaults).toContain("#FFAB19");
    expect(defaults).toContain("#59C059");
    const overridden = renderBlocks({ ...createDidacticBlocksElement(), source: uncategorizedSource, style: { statementColor: "#123456", scopeColor: "#234567", logicColor: "#345678" } });
    expect(overridden).toContain("#123456");
    expect(overridden).toContain("#234567");
    expect(overridden).toContain("#345678");
  });

  it("applies category overrides, authored text color, and block strokes independently", () => {
    const html = renderBlocks({
      ...createDidacticBlocksElement(),
      source: String.raw`\start[events](When flag clicked)\statement[motion](Move \value(10) steps)\scope[control](Repeat){\statement(Turn)}`,
      style: {
        border: { width: 5, style: "dashed", color: "#f97316" },
        categoryColors: { events: "#abcdef" },
        textColor: "#123456",
        blockBorder: { width: 2, style: "solid", color: "#111827" },
      },
    });
    expect(html).toContain('data-powershow-block-category="events"');
    expect(region(html, "start")).toContain("background:#abcdef");
    expect(region(html, "start")).toContain("color:#123456");
    expect(region(html, "value")).toContain("background:#f8fafc;color:#1e293b");
    expect(html).toContain("border-width:5px;border-style:dashed;border-color:#f97316");
    expect(html.match(/border-width:2px/g)?.length).toBeGreaterThan(2);
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
