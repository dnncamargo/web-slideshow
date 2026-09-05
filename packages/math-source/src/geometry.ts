import {
  evaluateMathEquation,
  type MathBindings,
  type MathEvaluationDiagnostic,
} from "./evaluator";
import type { MathSemanticEquation } from "./semantic";

export interface MathViewport2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface MathPoint2D {
  x: number;
  y: number;
}

export interface MathExplicit2DOptions {
  bindings?: MathBindings;
  sampleCount?: number;
}

export type MathGeometryDiagnostic =
  | {
      code:
        | "invalid-viewport"
        | "invalid-sample-count"
        | "invalid-grid"
        | "geometry-budget-exceeded"
        | "unsupported-equation-form"
        | "no-visible-geometry";
      message: string;
    }
  | {
      code: "evaluation-failed";
      message: string;
      cause: MathEvaluationDiagnostic;
    };

export interface MathGeometryResult {
  segments: MathPoint2D[][];
  diagnostics: MathGeometryDiagnostic[];
}

const DEFAULT_SAMPLE_COUNT = 256;
const MIN_SAMPLE_COUNT = 2;
const MAX_SAMPLE_COUNT = 512;

export function isValidMathViewport2D(viewport: MathViewport2D): boolean {
  return Number.isFinite(viewport.xMin) &&
    Number.isFinite(viewport.xMax) &&
    Number.isFinite(viewport.yMin) &&
    Number.isFinite(viewport.yMax) &&
    viewport.xMin < viewport.xMax &&
    viewport.yMin < viewport.yMax;
}

function invalidResult(
  code: "invalid-viewport" | "invalid-sample-count" | "invalid-grid" | "geometry-budget-exceeded" | "unsupported-equation-form",
  message: string,
): MathGeometryResult {
  return { segments: [], diagnostics: [{ code, message }] };
}

function isFatalEvaluationCode(code: MathEvaluationDiagnostic["code"]): boolean {
  return code === "missing-binding" || code === "invalid-binding" || code === "evaluation-budget-exceeded";
}

function appendSegment(segments: MathPoint2D[][], segment: MathPoint2D[]): void {
  if (segment.length >= 2) segments.push(segment);
}

export function generateExplicit2DGeometry(
  equation: MathSemanticEquation,
  viewport: MathViewport2D,
  options: MathExplicit2DOptions = {},
): MathGeometryResult {
  if (!isValidMathViewport2D(viewport)) {
    return invalidResult("invalid-viewport", "Viewport bounds must be finite and ordered.");
  }

  const sampleCount = options.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  if (!Number.isInteger(sampleCount) || sampleCount < MIN_SAMPLE_COUNT || sampleCount > MAX_SAMPLE_COUNT) {
    return invalidResult("invalid-sample-count", "Sample count must be an integer from 2 through 512.");
  }

  if (equation.form !== "explicit-y" && equation.form !== "explicit-x") {
    return invalidResult("unsupported-equation-form", "Only explicit-y and explicit-x equations are supported.");
  }

  const bindings = options.bindings ?? {};
  const segments: MathPoint2D[][] = [];
  let currentSegment: MathPoint2D[] = [];
  const isExplicitY = equation.form === "explicit-y";
  const domainMin = isExplicitY ? viewport.xMin : viewport.yMin;
  const domainMax = isExplicitY ? viewport.xMax : viewport.yMax;

  for (let index = 0; index < sampleCount; index += 1) {
    const domain = index === 0
      ? domainMin
      : index === sampleCount - 1
        ? domainMax
        : domainMin + (domainMax - domainMin) * (index / (sampleCount - 1));
    const sampleBindings: MathBindings = { ...bindings, [isExplicitY ? "x" : "y"]: domain };
    const evaluation = evaluateMathEquation(equation, sampleBindings);
    const diagnostic = evaluation.diagnostics[0];

    if (diagnostic !== undefined) {
      if (isFatalEvaluationCode(diagnostic.code)) {
        return {
          segments: [],
          diagnostics: [{
            code: "evaluation-failed",
            message: `Evaluation failed: ${diagnostic.message}`,
            cause: diagnostic,
          }],
        };
      }
      appendSegment(segments, currentSegment);
      currentSegment = [];
      continue;
    }

    if (evaluation.value === null || !Number.isFinite(evaluation.value)) {
      currentSegment = [];
      continue;
    }

    currentSegment.push(isExplicitY ? { x: domain, y: evaluation.value } : { x: evaluation.value, y: domain });
    if (index === sampleCount - 1) appendSegment(segments, currentSegment);
  }

  if (segments.length === 0) {
    return { segments: [], diagnostics: [{ code: "no-visible-geometry", message: "No visible geometry." }] };
  }
  return { segments, diagnostics: [] };
}
