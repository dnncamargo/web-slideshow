import { describe, expect, it } from "vitest";
import { BlocksElementSchema } from "@powershow/document-schema";
import { renderBlocks } from "../src/render-blocks";
import { createDidacticBlocksElement } from "./fixtures/render-fixtures";

describe("renderBlocks", () => {
  it("renders the source-only wrapper and hides hidden elements", () => {
    const fixture = createDidacticBlocksElement();
    const html = renderBlocks(fixture);
    expect(html).toContain('class="powershow-element powershow-blocks"');
    expect(html).toContain('data-powershow-id="didactic-blocks"');
    expect(html).toContain('data-powershow-type="blocks"');
    expect(html).toContain("powershow-blocks-source");
    expect(renderBlocks({ ...fixture, hidden: true })).toBe("");
  });

  it("escapes source text without parsing or executing it", () => {
    const fixture = { ...createDidacticBlocksElement(), source: `<script>alert("x")</script> &` };
    const html = renderBlocks(fixture);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp;");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("runtime");
    expect(html).not.toContain("eval(");
    expect(html).not.toContain("Function(");
  });

  it("accepts and renders the representative source fixture as one inert element", () => {
    const fixture = createDidacticBlocksElement();
    expect(() => BlocksElementSchema.parse(fixture)).not.toThrow();
    const html = renderBlocks(fixture);
    expect(html).toContain("When flag clicked");
    expect(html).toContain("move [10] steps");
    expect(html).toContain("repeat until [logic: touching [Sprite2]?");
    expect(html).toContain("stop all");
    expect(fixture.style?.statementColor).toBe("#3b82f6");
    expect(fixture.style?.scopeColor).toBe("#ef4444");
    expect(fixture.style?.logicColor).toBe("#f59e0b");
  });
});
