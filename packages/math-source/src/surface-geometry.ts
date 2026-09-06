import {
  evaluateMathEquation,
  type MathBindings,
  type MathEvaluationDiagnostic,
} from "./evaluator";
import type { MathSemanticEquation } from "./semantic";
import {
  isValidMathViewport2D,
  type MathGeometryDiagnostic,
  type MathViewport2D,
} from "./geometry";

export interface MathPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface MathExplicit3DSurfaceOptions {
  bindings?: MathBindings;
  xSampleCount?: number;
  ySampleCount?: number;
}

export interface MathSurfaceGeometryResult {
  rows: Array<Array<MathPoint3D | null>>;
  diagnostics: MathGeometryDiagnostic[];
}

const DEFAULT_SAMPLE_COUNT = 32;
const MIN_SAMPLE_COUNT = 2;
const MAX_SAMPLE_COUNT = 64;
const MAX_GEOMETRY_EVALUATIONS = 2048;

function diagnostic(
  code: "invalid-viewport" | "invalid-grid" | "geometry-budget-exceeded" | "unsupported-equation-form" | "no-visible-geometry",
  message: string,
): MathSurfaceGeometryResult {
  return { rows: [], diagnostics: [{ code, message }] };
}

function evaluationFailure(
  evaluation: ReturnType<typeof evaluateMathEquation>,
): MathSurfaceGeometryResult {
  const cause = evaluation.diagnostics[0]!;
  return {
    rows: [],
    diagnostics: [{
      code: "evaluation-failed",
      message: `Evaluation failed: ${cause.message}`,
      cause,
    }],
  };
}

function isFatalEvaluationCode(code: MathEvaluationDiagnostic["code"]): boolean {
  return code === "missing-binding" ||
    code === "invalid-binding" ||
    code === "evaluation-budget-exceeded";
}

function sampleCoordinate(min: number, max: number, index: number, count: number): number {
  return index === count - 1
    ? max
    : min + (max - min) * (index / (count - 1));
}

function isValidSampleCount(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_SAMPLE_COUNT && value <= MAX_SAMPLE_COUNT;
}

export function generateExplicit3DSurfaceGeometry(
  equation: MathSemanticEquation,
  domain: MathViewport2D,
  options: MathExplicit3DSurfaceOptions = {},
): MathSurfaceGeometryResult {
  if (!isValidMathViewport2D(domain)) {
    return diagnostic("invalid-viewport", "Viewport bounds must be finite and ordered.");
  }

  if (equation.form !== "explicit-z") {
    return diagnostic("unsupported-equation-form", "Only explicit-z equations are supported.");
  }

  const xSampleCount = options.xSampleCount ?? DEFAULT_SAMPLE_COUNT;
  const ySampleCount = options.ySampleCount ?? DEFAULT_SAMPLE_COUNT;
  if (!isValidSampleCount(xSampleCount) || !isValidSampleCount(ySampleCount)) {
    return diagnostic("invalid-grid", "Sample counts must be integers from 2 through 64.");
  }

  if (xSampleCount * ySampleCount > MAX_GEOMETRY_EVALUATIONS) {
    return diagnostic("geometry-budget-exceeded", "Geometry evaluation budget exceeded.");
  }

  const bindings = options.bindings ?? {};
  const rows: Array<Array<MathPoint3D | null>> = [];
  let finiteSampleCount = 0;

  for (let rowIndex = 0; rowIndex < ySampleCount; rowIndex += 1) {
    const y = sampleCoordinate(domain.yMin, domain.yMax, rowIndex, ySampleCount);
    const row: Array<MathPoint3D | null> = [];

    for (let columnIndex = 0; columnIndex < xSampleCount; columnIndex += 1) {
      const x = sampleCoordinate(domain.xMin, domain.xMax, columnIndex, xSampleCount);
      const evaluation = evaluateMathEquation(equation, { ...bindings, x, y });
      const cause = evaluation.diagnostics[0];

      if (cause !== undefined) {
        if (isFatalEvaluationCode(cause.code)) return evaluationFailure(evaluation);
        row.push(null);
        continue;
      }

      if (evaluation.value === null || !Number.isFinite(evaluation.value)) {
        row.push(null);
        continue;
      }

      row.push({ x, y, z: evaluation.value });
      finiteSampleCount += 1;
    }

    rows.push(row);
  }

  if (finiteSampleCount === 0) {
    return diagnostic("no-visible-geometry", "No visible geometry.");
  }

  return { rows, diagnostics: [] };
}
