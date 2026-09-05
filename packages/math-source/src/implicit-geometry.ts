import { evaluateMathEquation, type MathBindings } from "./evaluator";
import type { MathSemanticEquation } from "./semantic";
import {
  isValidMathViewport2D,
  type MathGeometryResult,
  type MathPoint2D,
  type MathViewport2D,
} from "./geometry";

export interface MathImplicit2DOptions {
  bindings?: MathBindings;
  gridWidth?: number;
  gridHeight?: number;
}

const DEFAULT_GRID_WIDTH = 32;
const DEFAULT_GRID_HEIGHT = 32;
const MAX_GRID_DIMENSION = 64;
const MAX_GEOMETRY_EVALUATIONS = 2048;

type GridVertex = { point: MathPoint2D; value: number } | { point: MathPoint2D; value: null };
type EdgeName = "bottom" | "right" | "top" | "left";

function diagnostic(
  code: "invalid-viewport" | "invalid-grid" | "geometry-budget-exceeded" | "unsupported-equation-form" | "no-visible-geometry",
  message: string,
): MathGeometryResult {
  return { segments: [], diagnostics: [{ code, message }] };
}

function evaluationFailure(evaluation: ReturnType<typeof evaluateMathEquation>): MathGeometryResult {
  const cause = evaluation.diagnostics[0]!;
  return {
    segments: [],
    diagnostics: [{ code: "evaluation-failed", message: `Evaluation failed: ${cause.message}`, cause }],
  };
}

function isFatal(code: string): boolean {
  return code === "missing-binding" || code === "invalid-binding" || code === "evaluation-budget-exceeded";
}

function coordinate(min: number, max: number, index: number, count: number): number {
  return index === count ? max : min + (max - min) * (index / count);
}

function intersection(a: GridVertex, b: GridVertex): MathPoint2D | null {
  if (a.value === null || b.value === null || (a.value >= 0) === (b.value >= 0)) return null;
  const t = a.value / (a.value - b.value);
  const point = {
    x: a.point.x + (b.point.x - a.point.x) * t,
    y: a.point.y + (b.point.y - a.point.y) * t,
  };
  return Number.isFinite(t) && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
}

function edgePoints(corners: { bl: GridVertex; br: GridVertex; tr: GridVertex; tl: GridVertex }): Partial<Record<EdgeName, MathPoint2D>> {
  const points: Partial<Record<EdgeName, MathPoint2D>> = {};
  const bottom = intersection(corners.bl, corners.br);
  const right = intersection(corners.br, corners.tr);
  const top = intersection(corners.tr, corners.tl);
  const left = intersection(corners.tl, corners.bl);
  if (bottom !== null) points.bottom = bottom;
  if (right !== null) points.right = right;
  if (top !== null) points.top = top;
  if (left !== null) points.left = left;
  return points;
}

function addSegment(segments: MathPoint2D[][], points: Partial<Record<EdgeName, MathPoint2D>>, first: EdgeName, second: EdgeName): void {
  const start = points[first];
  const end = points[second];
  if (start !== undefined && end !== undefined) segments.push([start, end]);
}

export function generateImplicit2DGeometry(
  equation: MathSemanticEquation,
  viewport: MathViewport2D,
  options: MathImplicit2DOptions = {},
): MathGeometryResult {
  if (!isValidMathViewport2D(viewport)) return diagnostic("invalid-viewport", "Viewport bounds must be finite and ordered.");
  if (equation.form !== "implicit-2d") return diagnostic("unsupported-equation-form", "Only implicit-2d equations are supported.");

  const gridWidth = options.gridWidth ?? DEFAULT_GRID_WIDTH;
  const gridHeight = options.gridHeight ?? DEFAULT_GRID_HEIGHT;
  if (!Number.isInteger(gridWidth) || !Number.isInteger(gridHeight) || gridWidth < 1 || gridWidth > MAX_GRID_DIMENSION || gridHeight < 1 || gridHeight > MAX_GRID_DIMENSION) {
    return diagnostic("invalid-grid", "Grid dimensions must be integers from 1 through 64.");
  }

  const columns = gridWidth + 1;
  const rows = gridHeight + 1;
  if (columns * rows > MAX_GEOMETRY_EVALUATIONS) return diagnostic("geometry-budget-exceeded", "Geometry evaluation budget exceeded.");

  const bindings = options.bindings ?? {};
  const grid: GridVertex[] = [];
  for (let row = 0; row < rows; row += 1) {
    const y = coordinate(viewport.yMin, viewport.yMax, row, gridHeight);
    for (let column = 0; column < columns; column += 1) {
      const x = coordinate(viewport.xMin, viewport.xMax, column, gridWidth);
      const point = { x, y };
      const evaluation = evaluateMathEquation(equation, { ...bindings, x, y });
      const cause = evaluation.diagnostics[0];
      if (cause !== undefined) {
        if (isFatal(cause.code)) return evaluationFailure(evaluation);
        grid.push({ point, value: null });
      } else if (evaluation.value === null || !Number.isFinite(evaluation.value)) {
        grid.push({ point, value: null });
      } else {
        grid.push({ point, value: evaluation.value });
      }
    }
  }

  const segments: MathPoint2D[][] = [];
  for (let row = 0; row < gridHeight; row += 1) {
    for (let column = 0; column < gridWidth; column += 1) {
      const bl = grid[row * columns + column]!;
      const br = grid[row * columns + column + 1]!;
      const tr = grid[(row + 1) * columns + column + 1]!;
      const tl = grid[(row + 1) * columns + column]!;
      const points = edgePoints({ bl, br, tr, tl });
      const crossed = (["bottom", "right", "top", "left"] as const).filter((edge) => points[edge] !== undefined);
      if (crossed.length === 4) {
        addSegment(segments, points, "bottom", "right");
        addSegment(segments, points, "top", "left");
      } else if (crossed.length === 2) {
        addSegment(segments, points, crossed[0]!, crossed[1]!);
      }
    }
  }

  return segments.length === 0 ? diagnostic("no-visible-geometry", "No visible geometry.") : { segments, diagnostics: [] };
}
