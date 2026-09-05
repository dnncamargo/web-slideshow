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

const CHART_WORKING_VIEWPORT: MathViewport2D = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
};

const AUTO_FIT_PADDING_RATIO = 0.08;

interface MathBounds2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function collectFiniteBounds(geometry: MathGeometryResult): MathBounds2D | undefined {
  let bounds: MathBounds2D | undefined;
  for (const segment of geometry.segments) {
    for (const point of segment) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      if (bounds === undefined) {
        bounds = { xMin: point.x, xMax: point.x, yMin: point.y, yMax: point.y };
        continue;
      }
      bounds.xMin = Math.min(bounds.xMin, point.x);
      bounds.xMax = Math.max(bounds.xMax, point.x);
      bounds.yMin = Math.min(bounds.yMin, point.y);
      bounds.yMax = Math.max(bounds.yMax, point.y);
    }
  }
  return bounds;
}

function fitAxis(rawMin: number, rawMax: number): [number, number] | undefined {
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax) || rawMin > rawMax) return undefined;

  if (rawMin === rawMax) {
    if (rawMin === 0) return [-1, 1];
    const delta = Math.max(Math.abs(rawMin) * 0.1, 0.000001);
    let min = rawMin - delta;
    let max = rawMin + delta;
    if (rawMin > 0 && min <= 0) min = rawMin * 0.5;
    if (rawMax < 0 && max >= 0) max = rawMax * 0.5;
    return [min, max];
  }

  const padding = (rawMax - rawMin) * AUTO_FIT_PADDING_RATIO;
  let min = rawMin - padding;
  let max = rawMax + padding;
  if (rawMin > 0 && min <= 0) min = rawMin * 0.5;
  if (rawMax < 0 && max >= 0) max = rawMax * 0.5;
  return [min, max];
}

function deriveAutoFitViewport(geometry: MathGeometryResult): MathViewport2D | undefined {
  const bounds = collectFiniteBounds(geometry);
  if (bounds === undefined) return undefined;
  const x = fitAxis(bounds.xMin, bounds.xMax);
  const y = fitAxis(bounds.yMin, bounds.yMax);
  if (x === undefined || y === undefined) return undefined;
  const viewport: MathViewport2D = { xMin: x[0], xMax: x[1], yMin: y[0], yMax: y[1] };
  return Number.isFinite(viewport.xMin) && Number.isFinite(viewport.xMax) &&
    Number.isFinite(viewport.yMin) && Number.isFinite(viewport.yMax) &&
    viewport.xMin < viewport.xMax && viewport.yMin < viewport.yMax
    ? viewport
    : undefined;
}

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
        result = generateExplicit2DGeometry(equation, CHART_WORKING_VIEWPORT, { bindings: {} });
        break;
      case "implicit-2d":
        result = generateImplicit2DGeometry(equation, CHART_WORKING_VIEWPORT, { bindings: {} });
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

  const displayViewport = element.fitToAxes === false
    ? deriveAutoFitViewport(geometry) ?? CHART_WORKING_VIEWPORT
    : CHART_WORKING_VIEWPORT;
  const svg = renderMathGeometrySvg(geometry, displayViewport, renderedEquationCount > 0
    ? { x: "x", y: allRenderedEquationsAreExplicitY ? "f(x)" : "y" }
    : undefined);
  if (svg === "") return renderChartFallback(element);

  return `<div class="powershow-element powershow-chart" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="chart"${renderChartLayout(element)}>${svg}</div>`;
}
