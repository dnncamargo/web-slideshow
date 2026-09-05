import type { MathGeometryResult, MathViewport2D } from "@powershow/math-source";

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

  return `<svg class="powershow-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" d="${subpaths.join(" ")}"></path></svg>`;
}
