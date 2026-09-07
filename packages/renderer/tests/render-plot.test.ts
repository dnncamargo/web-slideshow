import { describe, expect, it } from "vitest";

import type { PlotElement, InteractiveElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";
import { renderPlot as renderPlotWithOptions } from "../src/render-plot";

function plot(source: string, overrides: Partial<PlotElement> = {}): PlotElement {
  return {
    type: "plot",
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
  it("renders an animated Plot at its authored initial value", () => {
    const element = plot("y = x + t", {
      animation: { parameter: "t", from: 2, to: 4, durationMs: 1000 },
    });

    expect(renderPlotWithOptions(element)).toBe(
      renderPlotWithOptions(element, { bindings: { t: 2 } }),
    );
    expect(renderPlotWithOptions(element)).not.toContain("y = x + t");
  });

  it("supports pure transient bindings without mutating the Plot", () => {
    const element = plot("y = x + t", {
      animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 },
    });
    const initial = renderPlotWithOptions(element);
    const transient = renderPlotWithOptions(element, { bindings: { t: 3 } });

    expect(transient).not.toBe(initial);
    expect(element.animation).toEqual({ parameter: "t", from: 0, to: 1, durationMs: 1000 });
    expect(transient).not.toContain("y = x + t");
  });

  it("merges transient bindings with the animation initial binding", () => {
    const element = plot("y = x + t + a", {
      animation: { parameter: "t", from: 2, to: 4, durationMs: 1000 },
    });
    const html = renderPlotWithOptions(element, { bindings: { a: 3 } });

    expect(html).toContain("powershow-plot-svg");
    expect(html).not.toContain("[plot]");
  });

  it("applies the same transient binding to multiple 2D equations", () => {
    const element = plot("y = x + t\ny = x + 2*t");
    const html = renderPlotWithOptions(element, { bindings: { t: 3 } });

    expect(html).toContain("powershow-plot-svg");
    expect(html).not.toContain("[plot]");
  });

  it("applies transient bindings to explicit-z geometry", () => {
    const element = plot("z = x + y + t", {
      animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 },
    });
    const initial = renderPlotWithOptions(element);
    const transient = renderPlotWithOptions(element, { bindings: { t: 3 } });

    expect(initial).toContain("powershow-plot-surface-svg");
    expect(transient).toContain("powershow-plot-surface-svg");
    expect(transient).not.toBe(initial);
  });

  it("applies bindings to implicit 2D geometry", () => {
    const element = plot("x^2 + y^2 = t", {
      animation: { parameter: "t", from: 4, to: 9, durationMs: 1000 },
    });
    const html = renderPlotWithOptions(element);

    expect(html).toContain("powershow-plot-svg");
    expect(html).not.toContain("[plot]");
  });

  it("applies bindings to explicit-x geometry", () => {
    const element = plot("x = y + t", {
      animation: { parameter: "t", from: 2, to: 4, durationMs: 1000 },
    });
    const html = renderPlotWithOptions(element);

    expect(html).toContain("powershow-plot-svg");
    expect(html).not.toContain("[plot]");
  });

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
    "",
    "not valid syntax",
  ])("uses the neutral fallback when no renderable geometry survives: %s", (source) => {
    const html = renderPlot(source);
    expect(html).toContain("powershow-placeholder-plot");
    expect(html).toContain("[plot]");
    expect(html).not.toContain("powershow-plot-svg");
  });

  it("renders a single explicit-z equation as a 3D surface wireframe", () => {
    const html = renderPlot("z = sin(x) * cos(y)");
    expect(html).toContain("powershow-plot");
    expect(html).toContain("powershow-plot-svg");
    expect(html).toContain("powershow-plot-surface-svg");
    expect(html).toContain("powershow-plot-surface-wireframe");
    expect(html).not.toContain("[plot]");
  });

  it.each([undefined, true] as const)("shows explicit-z axes by default or when showAxes=%s", (showAxes) => {
    const html = renderPlot("z = x + y", showAxes === undefined ? {} : { showAxes });

    expect(html).toContain("powershow-plot-surface-wireframe");
    expect(html).toContain("powershow-plot-axis-x");
    expect(html).toContain("powershow-plot-axis-y");
    expect(html).toContain("powershow-plot-axis-z");
  });

  it("hides explicit-z axes without hiding the surface", () => {
    const html = renderPlot("z = x + y", { showAxes: false });

    expect(html).toContain("powershow-plot-surface-wireframe");
    expect(html).not.toContain("powershow-plot-axis");
  });

  it("hides 2D axes without changing the rendered curve", () => {
    const shown = renderPlot("y = x", { fitToAxes: false });
    const hidden = renderPlot("y = x", { fitToAxes: false, showAxes: false });

    expect(shown).toContain("powershow-plot-axis");
    expect(hidden).not.toContain("powershow-plot-axis");
    expect(hidden.match(/<path[^>]* d="([^"]+)"/)?.[1]).toBe(shown.match(/<path[^>]* d="([^"]+)"/)?.[1]);
  });

  it("keeps the default Plot background transparent", () => {
    const html = renderPlot("y = x");

    expect(html).not.toContain("background:");
    expect(html).not.toContain("transparent");
  });

  it("renders literal Plot color and background on the wrapper", () => {
    const html = renderPlot("y = x", {
      style: { color: "#ff0000", background: { color: "#112233" } },
    });

    expect(html).toContain("color:#ff0000;background:#112233");
    expect(html).toContain("powershow-plot-svg");
  });

  it("renders palette Plot color through the shared CSS variable", () => {
    const html = renderPlot("y = x", {
      style: { color: { kind: "palette", colorId: "accent" } },
    });

    expect(html).toContain("color:var(--ps-palette-0061006300630065006e0074)");
  });

  it("applies the same Plot color wrapper to explicit-z output", () => {
    const html = renderPlot("z = x + y", { style: { color: "#ff0000" } });

    expect(html).toContain("color:#ff0000");
    expect(html).toContain("powershow-plot-surface-wireframe");
  });

  it("passes explicit-z Plot Z colors into the mathematical gradient renderer", () => {
    const html = renderPlot("z = x + y", {
      style: { zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" } },
    });

    expect(html).toContain("powershow-plot-surface-wireframe-z-gradient");
    expect(html).toContain("color-mix(in srgb,#7c3aed");
    expect(html).toContain("#06b6d4");
  });

  it("styles 2D axes independently from the curve", () => {
    const html = renderPlot("y = x", {
      style: { color: "#00aa00", axes: { color: "#ff00aa", strokeWidth: 3 } },
    });

    expect(html).toContain('stroke="#ff00aa" stroke-width="3"');
    expect(html).toContain('fill="#ff00aa"');
    expect(html).toContain('stroke="currentColor" stroke-width="2"');
    expect(html).not.toContain("y = x");
  });

  it("keeps explicit-z axes independent from Z-gradient wireframe colors", () => {
    const html = renderPlot("z = x + y", {
      style: {
        axes: { color: "#ff00aa", strokeWidth: 3 },
        zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
      },
    });

    expect(html).toContain('stroke="#ff00aa" stroke-width="3"');
    expect(html).toContain('fill="#ff00aa"');
    expect(html).toContain("color-mix(in srgb,#7c3aed");
    expect(html).not.toContain('stroke="#ff00aa" stroke-width="1"');
  });

  it("preserves axis appearance for transient animated frames", () => {
    const element = plot("y = x + t", {
      animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 },
      style: { axes: { color: "#ff00aa", strokeWidth: 2 } },
    });

    const html = renderPlotWithOptions(element, { bindings: { t: 0.5 } });
    expect(html).toContain('stroke="#ff00aa" stroke-width="2"');
    expect(html).toContain('fill="#ff00aa"');
  });

  it("renders explicit-z palette gradient colors through shared CSS variables", () => {
    const html = renderPlot("z = x + y", {
      style: {
        zGradient: {
          minColor: { kind: "palette", colorId: "low" },
          maxColor: { kind: "palette", colorId: "high" },
        },
      },
    });

    expect(html).toContain("var(--ps-palette-006c006f0077)");
    expect(html).toContain("var(--ps-palette-0068006900670068)");
  });

  it("keeps zGradient inert for 2D Plot output", () => {
    const html = renderPlot("y = x", {
      style: { color: "#ff0000", zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" } },
    });

    expect(html).toContain("powershow-plot-svg");
    expect(html).not.toContain("powershow-plot-surface-wireframe-z-gradient");
    expect(html).toContain("color:#ff0000");
  });

  it("does not leak successful explicit-z source into markup", () => {
    const source = "z = sin(x) * cos(y)";
    const html = renderPlot(source);

    expect(html).toContain("powershow-plot-surface-svg");
    expect(html).not.toContain(source);
    expect(html).not.toContain("sin(x)");
    expect(html).not.toContain("cos(y)");
  });

  it.each(["z = x + y", "z = 2"])("renders explicit-z surface %s", (source) => {
    expect(renderPlot(source)).toContain("powershow-plot-surface-svg");
  });

  it("retains a surface around local domain gaps", () => {
    expect(renderPlot("z = sqrt(x)")).toContain("powershow-plot-surface-svg");
  });

  it("falls back for a fatal explicit-z parameter failure", () => {
    const html = renderPlot("z = a*x");
    expect(html).toContain("powershow-placeholder-plot");
    expect(html).toContain("[plot]");
    expect(html).not.toContain("Missing binding");
    expect(html).not.toContain("a*x");
  });

  it("falls back when multiple explicit-z equations are present", () => {
    const html = renderPlot("z = x + y\nz = x - y");
    expect(html).toContain("powershow-placeholder-plot");
    expect(html).not.toContain("powershow-plot-surface-svg");
  });

  it("preserves renderable 2D priority over an explicit-z sibling", () => {
    const html = renderPlot("y = x^2\nz = x + y");
    expect(html).toContain("powershow-plot-svg");
    expect(html).not.toContain("powershow-plot-surface-svg");
  });

  it("uses a valid explicit-z surface when a 2D sibling fails evaluation", () => {
    const html = renderPlot("y = a*x\nz = x + y");
    expect(html).toContain("powershow-plot-surface-svg");
    expect(html).not.toContain("[plot]");
  });

  it("recovers a valid explicit-z equation beside invalid syntax", () => {
    const html = renderPlot("invalid text\nz = sin(x) * cos(y)");
    expect(html).toContain("powershow-plot-surface-svg");
    expect(html).not.toContain("invalid text");
  });

  it("continues to use the neutral fallback for implicit-3d", () => {
    const html = renderPlot("x^2 + y^2 + z^2 = 1");
    expect(html).toContain("powershow-placeholder-plot");
    expect(html).not.toContain("powershow-plot-surface-svg");
  });

  it.each([true, false])("keeps explicit-z output valid regardless of fitToAxes=%s", (fitToAxes) => {
    expect(renderPlot("z = x + y", { fitToAxes })).toContain("powershow-plot-surface-svg");
  });

  it("applies complete canonical layout to an explicit-z surface", () => {
    const html = renderPlot("z = x + y", {
      layout: { width: "80%", height: 240, position: "absolute", top: "1rem", left: 12 },
    });
    expect(html).toContain("powershow-plot-surface-svg");
    expect(html).toContain("width:80%;height:240px;position:absolute;top:1rem;left:12px");
  });

  it("returns nothing for a hidden explicit-z Plot", () => {
    expect(renderPlot("z = x + y", { hidden: true })).toBe("");
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
