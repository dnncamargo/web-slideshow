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

interface SurfaceBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

interface ProjectedAxis {
  name: "x" | "y" | "z";
  start: ProjectedPoint;
  end: ProjectedPoint;
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
  const u = (point.x - point.y) * Math.SQRT1_2;
  const v = point.z * (Math.sqrt(3) / 2) - (point.x + point.y) * Math.SQRT1_2 * 0.5;
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
  extraPoints: ProjectedPoint[] = [],
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
  for (const point of extraPoints) {
    if (bounds === undefined) {
      bounds = { minU: point.u, maxU: point.u, minV: point.v, maxV: point.v };
      continue;
    }
    bounds.minU = Math.min(bounds.minU, point.u);
    bounds.maxU = Math.max(bounds.maxU, point.u);
    bounds.minV = Math.min(bounds.minV, point.v);
    bounds.maxV = Math.max(bounds.maxV, point.v);
  }
  return bounds;
}

function collectSurfaceBounds(
  geometry: MathSurfaceGeometryResult,
): SurfaceBounds | undefined {
  let bounds: SurfaceBounds | undefined;
  for (const row of geometry.rows) {
    for (const point of row) {
      if (!isFinitePoint(point)) continue;
      if (bounds === undefined) {
        bounds = { xMin: point.x, xMax: point.x, yMin: point.y, yMax: point.y, zMin: point.z, zMax: point.z };
        continue;
      }
      bounds.xMin = Math.min(bounds.xMin, point.x);
      bounds.xMax = Math.max(bounds.xMax, point.x);
      bounds.yMin = Math.min(bounds.yMin, point.y);
      bounds.yMax = Math.max(bounds.yMax, point.y);
      bounds.zMin = Math.min(bounds.zMin, point.z);
      bounds.zMax = Math.max(bounds.zMax, point.z);
    }
  }
  return bounds;
}

function usableRange(min: number, max: number): [number, number] {
  if (min < max) return [min, max];
  if (min === 0) return [-1, 1];
  const delta = Math.max(Math.abs(min) * 0.1, MIN_DEGENERATE_SPAN);
  return [min - delta, max + delta];
}

function createAxes(geometry: MathSurfaceGeometryResult): ProjectedAxis[] {
  const bounds = collectSurfaceBounds(geometry);
  if (bounds === undefined) return [];

  const [xMin, xMax] = usableRange(bounds.xMin, bounds.xMax);
  const [yMin, yMax] = usableRange(bounds.yMin, bounds.yMax);
  const [zMin, zMax] = usableRange(Math.min(0, bounds.zMin), Math.max(0, bounds.zMax));
  const axes = [
    { name: "x" as const, start: { x: xMin, y: 0, z: 0 }, end: { x: xMax, y: 0, z: 0 } },
    { name: "y" as const, start: { x: 0, y: yMin, z: 0 }, end: { x: 0, y: yMax, z: 0 } },
    { name: "z" as const, start: { x: 0, y: 0, z: zMin }, end: { x: 0, y: 0, z: zMax } },
  ];
  return axes.flatMap((axis) => {
    const start = project(axis.start);
    const end = project(axis.end);
    return start !== null && end !== null ? [{ name: axis.name, start, end }] : [];
  });
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
  options: { showAxes?: boolean } = {},
): string {
  const rows = projectRows(geometry);
  const axes = options.showAxes === false ? [] : createAxes(geometry);
  const axisPoints = axes.flatMap((axis) => [axis.start, axis.end]);
  const bounds = collectBounds(rows, axisPoints);
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

  const axisMarkup = axes.map((axis) => {
    const x1 = axis.start.u - projectionBounds.minU;
    const y1 = projectionBounds.maxV - axis.start.v;
    const x2 = axis.end.u - projectionBounds.minU;
    const y2 = projectionBounds.maxV - axis.end.v;
    return `<line class="powershow-plot-axis powershow-plot-axis-${axis.name}" x1="${formatNumber(x1)}" y1="${formatNumber(y1)}" x2="${formatNumber(x2)}" y2="${formatNumber(y2)}" stroke-width="1" vector-effect="non-scaling-stroke"></line><text class="powershow-plot-axis-label powershow-plot-axis-label-${axis.name}" x="${formatNumber(x2)}" y="${formatNumber(y2)}" text-anchor="start" font-size="1.2">${axis.name}</text>`;
  }).join("");

  return `<svg class="powershow-plot-svg powershow-plot-surface-svg" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" aria-hidden="true" focusable="false">${axisMarkup}<path class="powershow-plot-surface-wireframe" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" d="${subpaths.join(" ")}"></path></svg>`;
}
