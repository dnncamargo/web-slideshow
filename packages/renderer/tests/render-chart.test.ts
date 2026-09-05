import { describe, expect, it } from "vitest";

import type { ChartElement, InteractiveElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

function chart(source: string, overrides: Partial<ChartElement> = {}): ChartElement {
  return {
    type: "chart",
    id: "chart-test",
    hidden: false,
    source,
    ...overrides,
  };
}

function renderChart(source: string, overrides: Partial<ChartElement> = {}): string {
  return renderElement(chart(source, overrides));
}

describe("Chart renderer", () => {
  it.each([
    "y = x^2",
    "x = y^2",
    "x^2 + y^2 = 1",
  ])("renders supported 2D equation %s as SVG", (source) => {
    const html = renderChart(source);
    expect(html).toContain("powershow-chart");
    expect(html).toContain("powershow-chart-svg");
    expect(html).toContain("<path");
    expect(html).toContain('viewBox="0 0 20 20"');
    expect(html).not.toContain("[chart]");
  });

  it("combines multiple supported equations into one SVG and path", () => {
    const html = renderChart("y = x\nx = y^2");
    expect(html.match(/<svg /g)).toHaveLength(1);
    expect(html.match(/<path /g)).toHaveLength(1);
    expect(html.match(/M /g)).toHaveLength(2);
  });

  it("keeps valid equations when a sibling has invalid syntax", () => {
    const html = renderChart("not valid syntax\ny = x^2");
    expect(html).toContain("powershow-chart-svg");
    expect(html).not.toContain("not valid syntax");
  });

  it("keeps a valid equation when another equation is missing a binding", () => {
    const html = renderChart("y = a*x\ny = x^2");
    expect(html).toContain("powershow-chart-svg");
    expect(html).not.toContain("Missing binding");
  });

  it.each([
    "y = a*x",
    "z = x + y",
    "",
    "not valid syntax",
  ])("uses the neutral fallback when no renderable geometry survives: %s", (source) => {
    const html = renderChart(source);
    expect(html).toContain("powershow-placeholder-chart");
    expect(html).toContain("[chart]");
    expect(html).not.toContain("powershow-chart-svg");
  });

  it("returns nothing for a hidden Chart without analyzing its source", () => {
    expect(renderChart("identifier that must not be analyzed", { hidden: true })).toBe("");
  });

  it("applies the complete canonical layout to a successful Chart", () => {
    const html = renderChart("y = x", {
      layout: { width: "80%", height: 240, position: "absolute", top: "1rem", left: 12 },
    });
    expect(html).toContain("width:80%;height:240px;position:absolute;top:1rem;left:12px");
  });

  it("applies the complete canonical layout to a fallback Chart", () => {
    const html = renderChart("y = a*x", {
      layout: { width: "80%", height: 240, position: "absolute", top: "1rem", left: 12 },
    });
    expect(html).toContain("width:80%;height:240px;position:absolute;top:1rem;left:12px");
  });

  it("does not leak authored Chart source into markup", () => {
    const source = "y = sourceIdentifierThatMustNotLeak";
    const html = renderChart(source);
    expect(html).not.toContain("sourceIdentifierThatMustNotLeak");
    expect(html).not.toContain(source);
  });

  it("preserves the existing Interactive placeholder path", () => {
    const element: InteractiveElement = {
      type: "interactive",
      id: "interactive-test",
      hidden: false,
      widget: "function-plot",
      config: {},
    };
    expect(renderElement(element)).toBe(
      '<div class="powershow-element powershow-placeholder powershow-placeholder-interactive" data-powershow-id="interactive-test" data-powershow-type="interactive">[interactive]</div>',
    );
  });
});
