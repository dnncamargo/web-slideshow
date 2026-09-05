import type { ChartElement } from "@powershow/document-schema";
import {
  analyzeMathSource,
  generateExplicit2DGeometry,
  generateImplicit2DGeometry,
  type MathGeometryResult,
  type MathViewport2D,
} from "@powershow/math-source";

import { escapeHtml } from "./escape-html";
import { renderLength } from "./render-length";
import { renderMathGeometrySvg } from "./render-chart-svg";

const CHART_VIEWPORT: MathViewport2D = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
};

function renderChartLayout(element: ChartElement): string {
  const layout = element.layout;
  if (layout === undefined) return "";

  const styles: string[] = [];
  for (const [property, value] of [
    ["width", layout.width],
    ["height", layout.height],
    ["position", layout.position],
    ["top", layout.top],
    ["right", layout.right],
    ["bottom", layout.bottom],
    ["left", layout.left],
  ] as const) {
    if (value !== undefined) {
      styles.push(`${property}:${property === "position" ? value : renderLength(value)}`);
    }
  }

  return styles.length > 0 ? ` style="${escapeHtml(styles.join(";"))}"` : "";
}

function renderChartFallback(element: ChartElement): string {
  return `<div class="powershow-element powershow-placeholder powershow-placeholder-chart" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="chart"${renderChartLayout(element)}>[chart]</div>`;
}

function appendGeometry(target: MathGeometryResult, result: MathGeometryResult): void {
  target.segments.push(...result.segments);
}

export function renderChart(element: ChartElement): string {
  if (element.hidden) return "";

  const geometry: MathGeometryResult = { segments: [], diagnostics: [] };
  const analysis = analyzeMathSource(element.source);
  let renderedEquationCount = 0;
  let allRenderedEquationsAreExplicitY = true;

  for (const equation of analysis.equations) {
    let result: MathGeometryResult;
    switch (equation.form) {
      case "explicit-y":
      case "explicit-x":
        result = generateExplicit2DGeometry(equation, CHART_VIEWPORT, { bindings: {} });
        break;
      case "implicit-2d":
        result = generateImplicit2DGeometry(equation, CHART_VIEWPORT, { bindings: {} });
        break;
      case "explicit-z":
      case "implicit-3d":
        continue;
    }
    if (result.segments.length > 0) {
      renderedEquationCount += 1;
      if (equation.form !== "explicit-y") allRenderedEquationsAreExplicitY = false;
    }
    appendGeometry(geometry, result);
  }

  const svg = renderMathGeometrySvg(geometry, CHART_VIEWPORT, renderedEquationCount > 0
    ? { x: "x", y: allRenderedEquationsAreExplicitY ? "f(x)" : "y" }
    : undefined);
  if (svg === "") return renderChartFallback(element);

  return `<div class="powershow-element powershow-chart" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="chart"${renderChartLayout(element)}>${svg}</div>`;
}
