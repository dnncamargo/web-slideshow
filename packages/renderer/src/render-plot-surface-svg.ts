import type {
  MathPoint3D,
  MathSurfaceGeometryResult,
} from "@powershow/math-source";

interface ProjectedPoint {
  u: number;
  v: number;
}

interface ProjectedBounds {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

const PADDING_RATIO = 0.08;
const MIN_DEGENERATE_SPAN = 0.000001;

function isFinitePoint(value: unknown): value is MathPoint3D {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return typeof point.x === "number" && Number.isFinite(point.x) &&
    typeof point.y === "number" && Number.isFinite(point.y) &&
    typeof point.z === "number" && Number.isFinite(point.z);
}

function project(point: MathPoint3D): ProjectedPoint | null {
  const u = (point.x - point.y) * Math.sqrt(3) / 2;
  const v = point.z - (point.x + point.y) / 2;
  return Number.isFinite(u) && Number.isFinite(v) ? { u, v } : null;
}

function projectRows(
  geometry: MathSurfaceGeometryResult,
): Array<Array<ProjectedPoint | null>> {
  if (!Array.isArray(geometry.rows)) return [];

  return geometry.rows.map((row) => {
    if (!Array.isArray(row)) return [];
    return row.map((point) => {
      if (!isFinitePoint(point)) return null;
      return project(point);
    });
  });
}

function collectBounds(
  rows: Array<Array<ProjectedPoint | null>>,
): ProjectedBounds | undefined {
  let bounds: ProjectedBounds | undefined;
  for (const row of rows) {
    for (const point of row) {
      if (point === null) continue;
      if (bounds === undefined) {
        bounds = { minU: point.u, maxU: point.u, minV: point.v, maxV: point.v };
        continue;
      }
      bounds.minU = Math.min(bounds.minU, point.u);
      bounds.maxU = Math.max(bounds.maxU, point.u);
      bounds.minV = Math.min(bounds.minV, point.v);
      bounds.maxV = Math.max(bounds.maxV, point.v);
    }
  }
  return bounds;
}

function paddedAxis(min: number, max: number): [number, number] | undefined {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return undefined;

  if (min === max) {
    const delta = Math.max(Math.abs(min) * 0.1, MIN_DEGENERATE_SPAN);
    if (!Number.isFinite(delta)) return undefined;
    const paddedMin = min - delta;
    const paddedMax = max + delta;
    return Number.isFinite(paddedMin) && Number.isFinite(paddedMax) && paddedMin < paddedMax
      ? [paddedMin, paddedMax]
      : undefined;
  }

  const padding = (max - min) * PADDING_RATIO;
  if (!Number.isFinite(padding)) return undefined;
  const paddedMin = min - padding;
  const paddedMax = max + padding;
  return Number.isFinite(paddedMin) && Number.isFinite(paddedMax) && paddedMin < paddedMax
    ? [paddedMin, paddedMax]
    : undefined;
}

function formatNumber(value: number): string {
  return Object.is(value, -0) ? "0" : String(value);
}

function appendRun(
  subpaths: string[],
  run: ProjectedPoint[],
  bounds: { minU: number; maxV: number },
): void {
  if (run.length < 2) return;

  const [first, ...rest] = run;
  if (first === undefined) return;

  const commands = [
    `M ${formatNumber(first.u - bounds.minU)} ${formatNumber(bounds.maxV - first.v)}`,
  ];
  for (const point of rest) {
    commands.push(
      `L ${formatNumber(point.u - bounds.minU)} ${formatNumber(bounds.maxV - point.v)}`,
    );
  }
  subpaths.push(commands.join(" "));
}

function appendRowRuns(
  subpaths: string[],
  rows: Array<Array<ProjectedPoint | null>>,
  bounds: { minU: number; maxV: number },
): void {
  for (const row of rows) {
    let run: ProjectedPoint[] = [];
    for (const point of row) {
      if (point === null) {
        appendRun(subpaths, run, bounds);
        run = [];
      } else {
        run.push(point);
      }
    }
    appendRun(subpaths, run, bounds);
  }
}

function appendColumnRuns(
  subpaths: string[],
  rows: Array<Array<ProjectedPoint | null>>,
  bounds: { minU: number; maxV: number },
): void {
  const columnCount = rows.reduce((count, row) => Math.max(count, row.length), 0);
  for (let column = 0; column < columnCount; column += 1) {
    let run: ProjectedPoint[] = [];
    for (const row of rows) {
      const point = row[column];
      if (point === undefined || point === null) {
        appendRun(subpaths, run, bounds);
        run = [];
      } else {
        run.push(point);
      }
    }
    appendRun(subpaths, run, bounds);
  }
}

/** Projects a structured 3D surface into a deterministic SVG wireframe. */
export function renderMathSurfaceGeometrySvg(
  geometry: MathSurfaceGeometryResult,
): string {
  const rows = projectRows(geometry);
  const bounds = collectBounds(rows);
  if (bounds === undefined) return "";

  const u = paddedAxis(bounds.minU, bounds.maxU);
  const v = paddedAxis(bounds.minV, bounds.maxV);
  if (u === undefined || v === undefined) return "";

  const width = u[1] - u[0];
  const height = v[1] - v[0];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "";

  const subpaths: string[] = [];
  const projectionBounds = { minU: u[0], maxV: v[1] };
  appendRowRuns(subpaths, rows, projectionBounds);
  appendColumnRuns(subpaths, rows, projectionBounds);
  if (subpaths.length === 0) return "";

  return `<svg class="powershow-plot-svg powershow-plot-surface-svg" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" aria-hidden="true" focusable="false"><path class="powershow-plot-surface-wireframe" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" d="${subpaths.join(" ")}"></path></svg>`;
}
