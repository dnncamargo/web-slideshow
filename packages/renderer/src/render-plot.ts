import type { PlotElement } from "@powershow/document-schema";
import {
  analyzeMathSource,
  generateExplicit3DSurfaceGeometry,
  generateExplicit2DGeometry,
  generateImplicit2DGeometry,
  type MathBindings,
  type MathGeometryResult,
  type MathViewport2D,
} from "@powershow/math-source";

import { escapeHtml } from "./escape-html";
import { renderLength } from "./render-length";
import { renderColorValue } from "./render-palette";
import { renderMathGeometrySvg } from "./render-plot-svg";
import { renderMathSurfaceGeometrySvg } from "./render-plot-surface-svg";

const PLOT_WORKING_VIEWPORT: MathViewport2D = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
};

const AUTO_FIT_PADDING_RATIO = 0.08;

export interface PlotRenderOptions {
  bindings?: MathBindings;
}

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

function renderPlotStyle(element: PlotElement): string {
  const layout = element.layout;
  const styles: string[] = [];
  if (layout !== undefined) {
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
  }

  if (element.style?.color !== undefined) {
    styles.push(`color:${renderColorValue(element.style.color)}`);
  }
  if (element.style?.background?.color !== undefined) {
    styles.push(`background:${renderColorValue(element.style.background.color)}`);
  }

  return styles.length > 0 ? ` style="${escapeHtml(styles.join(";"))}"` : "";
}

function appendGeometry(target: MathGeometryResult, result: MathGeometryResult): void {
  target.segments.push(...result.segments);
}

export interface PlotFrame {
  readonly className: "powershow-plot" | "powershow-placeholder powershow-placeholder-plot";
  readonly content: string;
}

export function renderPlotFrame(element: PlotElement, options: PlotRenderOptions = {}): PlotFrame | null {
  if (element.hidden) return null;

  const initialBindings = element.animation === undefined
    ? {}
    : { [element.animation.parameter]: element.animation.from };
  const bindings = { ...initialBindings, ...options.bindings };
  const geometry: MathGeometryResult = { segments: [], diagnostics: [] };
  const analysis = analyzeMathSource(element.source);
  let renderedEquationCount = 0;
  let allRenderedEquationsAreExplicitY = true;

  for (const equation of analysis.equations) {
    let result: MathGeometryResult;
    switch (equation.form) {
      case "explicit-y":
      case "explicit-x":
        result = generateExplicit2DGeometry(equation, PLOT_WORKING_VIEWPORT, { bindings });
        break;
      case "implicit-2d":
        result = generateImplicit2DGeometry(equation, PLOT_WORKING_VIEWPORT, { bindings });
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

  const axisStyle = element.style?.axes === undefined
    ? undefined
    : {
      ...(element.style.axes.color === undefined ? {} : { color: renderColorValue(element.style.axes.color) }),
      ...(element.style.axes.strokeWidth === undefined ? {} : { strokeWidth: element.style.axes.strokeWidth }),
      ...(element.style.axes.opacity === undefined ? {} : { opacity: element.style.axes.opacity }),
    };

  if (renderedEquationCount === 0) {
    const explicitSurfaceEquations = analysis.equations.filter(
      (equation) => equation.form === "explicit-z",
    );

    if (explicitSurfaceEquations.length === 1) {
      const surfaceGeometry = generateExplicit3DSurfaceGeometry(
        explicitSurfaceEquations[0]!,
        PLOT_WORKING_VIEWPORT,
        { bindings },
      );
      const surfaceSvg = renderMathSurfaceGeometrySvg(surfaceGeometry, {
        showAxes: element.showAxes !== false,
        ...(axisStyle === undefined ? {} : { axisStyle }),
        ...(element.style?.zGradient === undefined ? {} : {
          zGradient: {
            minColor: renderColorValue(element.style.zGradient.minColor),
            maxColor: renderColorValue(element.style.zGradient.maxColor),
          },
        }),
      });
      if (surfaceSvg !== "") {
        return { className: "powershow-plot", content: surfaceSvg };
      }
    }
  }

  const displayViewport = element.fitToAxes === false
    ? deriveAutoFitViewport(geometry) ?? PLOT_WORKING_VIEWPORT
    : PLOT_WORKING_VIEWPORT;
  const svg = renderMathGeometrySvg(geometry, displayViewport, renderedEquationCount > 0
    ? {
      x: "x",
      y: allRenderedEquationsAreExplicitY ? "f(x)" : "y",
      showAxes: element.showAxes !== false,
      ...(axisStyle === undefined ? {} : { axisStyle }),
    }
    : undefined);
  if (svg === "") return { className: "powershow-placeholder powershow-placeholder-plot", content: "[plot]" };

  return { className: "powershow-plot", content: svg };
}

export function renderPlot(element: PlotElement, options: PlotRenderOptions = {}): string {
  const frame = renderPlotFrame(element, options);
  if (frame === null) return "";
  return `<div class="powershow-element ${frame.className}" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="plot"${renderPlotStyle(element)}>${frame.content}</div>`;
}
