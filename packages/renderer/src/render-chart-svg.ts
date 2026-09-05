import type { MathGeometryResult, MathViewport2D } from "@powershow/math-source";

export interface MathChartAxisLabels {
  x: string;
  y: string;
}

function isValidViewport(viewport: MathViewport2D): boolean {
  return Number.isFinite(viewport.xMin) &&
    Number.isFinite(viewport.xMax) &&
    Number.isFinite(viewport.yMin) &&
    Number.isFinite(viewport.yMax) &&
    viewport.xMin < viewport.xMax &&
    viewport.yMin < viewport.yMax;
}

function isFinitePoint(point: { x: number; y: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** Projects validated math-space geometry into a deterministic, self-contained SVG. */
export function renderMathGeometrySvg(
  geometry: MathGeometryResult,
  viewport: MathViewport2D,
  axisLabels?: MathChartAxisLabels,
): string {
  if (!isValidViewport(viewport) || geometry.segments.length === 0) return "";

  const width = viewport.xMax - viewport.xMin;
  const height = viewport.yMax - viewport.yMin;
  const subpaths: string[] = [];

  for (const segment of geometry.segments) {
    if (segment.length < 2 || segment.some((point) => !isFinitePoint(point))) continue;

    const [firstPoint, ...remainingPoints] = segment;
    if (firstPoint === undefined) continue;

    const firstX = firstPoint.x - viewport.xMin;
    const firstY = viewport.yMax - firstPoint.y;
    const commands = [`M ${firstX} ${firstY}`];
    for (const point of remainingPoints) {
      commands.push(`L ${point.x - viewport.xMin} ${viewport.yMax - point.y}`);
    }
    subpaths.push(commands.join(" "));
  }

  if (subpaths.length === 0) return "";

  const xAxisY = viewport.yMax;
  const yAxisX = -viewport.xMin;
  const axes: string[] = [];
  if (viewport.yMin <= 0 && viewport.yMax >= 0) {
    axes.push(`<line class="powershow-chart-axis powershow-chart-axis-x" x1="0" y1="${xAxisY}" x2="${width}" y2="${xAxisY}" stroke-width="1" vector-effect="non-scaling-stroke"></line>`);
  }
  if (viewport.xMin <= 0 && viewport.xMax >= 0) {
    axes.push(`<line class="powershow-chart-axis powershow-chart-axis-y" x1="${yAxisX}" y1="0" x2="${yAxisX}" y2="${height}" stroke-width="1" vector-effect="non-scaling-stroke"></line>`);
  }

  const labels: string[] = [];
  if (axisLabels !== undefined) {
    if (viewport.yMin <= 0 && viewport.yMax >= 0) {
      labels.push(`<text class="powershow-chart-axis-label powershow-chart-axis-label-x" x="${width - 0.5}" y="${Math.min(height - 0.5, Math.max(1.25, xAxisY - 0.5))}" text-anchor="end" font-size="1.2">${axisLabels.x}</text>`);
    }
    if (viewport.xMin <= 0 && viewport.xMax >= 0) {
      labels.push(`<text class="powershow-chart-axis-label powershow-chart-axis-label-y" x="${Math.min(width - 0.5, Math.max(0.5, yAxisX + 0.5))}" y="1.5" text-anchor="start" font-size="1.2">${axisLabels.y}</text>`);
    }
  }

  return `<svg class="powershow-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" aria-hidden="true" focusable="false">${axes.join("")}${labels.join("")}<path fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" d="${subpaths.join(" ")}"></path></svg>`;
}
