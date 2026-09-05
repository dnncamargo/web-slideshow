import { describe, expect, it } from "vitest";

import type { PlotElement, InteractiveElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

function plot(source: string, overrides: Partial<PlotElement> = {}): PlotElement {
  return {
    type: "chart",
    id: "plot-test",
    hidden: false,
    source,
    ...overrides,
  };
}

function renderPlot(source: string, overrides: Partial<PlotElement> = {}): string {
  return renderElement(plot(source, overrides));
}

function viewBox(html: string): [number, number] {
  const match = html.match(/viewBox="0 0 ([^ ]+) ([^"]+)"/);
  if (match?.[1] === undefined || match[2] === undefined) throw new Error("Missing viewBox");
  return [Number(match[1]), Number(match[2])];
}

describe("Plot renderer", () => {
  it.each([
    "y = x^2",
    "x = y^2",
    "x^2 + y^2 = 1",
  ])("renders supported 2D equation %s as SVG", (source) => {
    const html = renderPlot(source);
    expect(html).toContain("powershow-plot");
    expect(html).toContain("powershow-plot-svg");
    expect(html).toContain("<path");
    expect(html).toContain('viewBox="0 0 20 20"');
    expect(html).not.toContain("[plot]");
  });

  it("keeps the fixed viewport when fitToAxes is explicitly true", () => {
    expect(renderPlot("y = x^2", { fitToAxes: true })).toContain('viewBox="0 0 20 20"');
  });

  it("derives an automatic display viewport from generated geometry", () => {
    const html = renderPlot("y = x^2", { fitToAxes: false });
    const [, height] = viewBox(html);
    expect(height).toBeGreaterThan(20);
    expect(html).not.toContain('viewBox="0 0 20 20"');
  });

  it("fits a positive constant explicit-y without manufacturing an x-axis", () => {
    const html = renderPlot("y = 5", { fitToAxes: false });
    const [, height] = viewBox(html);
    expect(height).toBeGreaterThan(0);
    expect(html).not.toContain("powershow-plot-axis-x");
    expect(html).toContain("powershow-plot-axis-y");
    expect(html).not.toContain('viewBox="0 0 20 20"');
  });

  it("fits a positive constant explicit-x with only the x-axis visible", () => {
    const html = renderPlot("x = 5", { fitToAxes: false });
    expect(html).toContain("powershow-plot-axis-x");
    expect(html).not.toContain("powershow-plot-axis-y");
  });

  it("keeps a zero constant in a valid non-degenerate viewport", () => {
    const html = renderPlot("y = 0", { fitToAxes: false });
    const [width, height] = viewBox(html);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(html).toContain("powershow-plot-axis-x");
  });

  it("does not manufacture an x-axis for a shifted positive function", () => {
    const html = renderPlot("y = x^2 + 1", { fitToAxes: false });
    expect(html).not.toContain("powershow-plot-axis-x");
    expect(html).toContain("powershow-plot-axis-y");
  });

  it("uses the union of multiple equations for automatic bounds", () => {
    const [, singleHeight] = viewBox(renderPlot("y = x^2", { fitToAxes: false }));
    const [, combinedHeight] = viewBox(renderPlot("y = x^2\ny = 200", { fitToAxes: false }));
    expect(combinedHeight).toBeGreaterThan(singleHeight);
  });

  it("uses f(x) only when every renderable equation is explicit-y", () => {
    expect(renderPlot("y = x^2\ny = sin(x)")).toContain(">f(x)</text>");
    expect(renderPlot("y = x^2\nx^2 + y^2 = 1")).toContain(">y</text>");
    expect(renderPlot("x = y^2")).not.toContain("f(x)");
  });

  it("combines multiple supported equations into one SVG and path", () => {
    const html = renderPlot("y = x\nx = y^2");
    expect(html.match(/<svg /g)).toHaveLength(1);
    expect(html.match(/<path /g)).toHaveLength(1);
    expect(html.match(/M /g)).toHaveLength(2);
  });

  it("keeps valid equations when a sibling has invalid syntax", () => {
    const html = renderPlot("not valid syntax\ny = x^2");
    expect(html).toContain("powershow-plot-svg");
    expect(html).not.toContain("not valid syntax");
  });

  it("keeps a valid equation when another equation is missing a binding", () => {
    const html = renderPlot("y = a*x\ny = x^2");
    expect(html).toContain("powershow-plot-svg");
    expect(html).not.toContain("Missing binding");
  });

  it.each([
    "y = a*x",
    "z = x + y",
    "",
    "not valid syntax",
  ])("uses the neutral fallback when no renderable geometry survives: %s", (source) => {
    const html = renderPlot(source);
    expect(html).toContain("powershow-placeholder-plot");
    expect(html).toContain("[plot]");
    expect(html).not.toContain("powershow-plot-svg");
  });

  it("returns nothing for a hidden Plot without analyzing its source", () => {
    expect(renderPlot("identifier that must not be analyzed", { hidden: true })).toBe("");
  });

  it("applies the complete canonical layout to a successful Plot", () => {
    const html = renderPlot("y = x", {
      layout: { width: "80%", height: 240, position: "absolute", top: "1rem", left: 12 },
    });
    expect(html).toContain("width:80%;height:240px;position:absolute;top:1rem;left:12px");
  });

  it("applies the complete canonical layout to a fallback Plot", () => {
    const html = renderPlot("y = a*x", {
      layout: { width: "80%", height: 240, position: "absolute", top: "1rem", left: 12 },
    });
    expect(html).toContain("width:80%;height:240px;position:absolute;top:1rem;left:12px");
  });

  it("does not leak authored Plot source into markup", () => {
    const source = "y = sourceIdentifierThatMustNotLeak";
    const html = renderPlot(source);
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
