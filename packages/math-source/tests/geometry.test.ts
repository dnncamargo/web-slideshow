import { describe, expect, it } from "vitest";
import {
  analyzeMathSource,
  generateExplicit2DGeometry,
  type MathSemanticEquation,
} from "../src";
import type { MathExpression } from "../src/parser";

function equation(source: string): MathSemanticEquation {
  const result = analyzeMathSource(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.equations).toHaveLength(1);
  return result.equations[0]!;
}

describe("generateExplicit2DGeometry", () => {
  it("samples explicit-y endpoints and interior points deterministically", () => {
    expect(generateExplicit2DGeometry(equation("y = x^2"), { xMin: -2, xMax: 2, yMin: -10, yMax: 10 }, { sampleCount: 5 })).toEqual({
      segments: [[
        { x: -2, y: 4 }, { x: -1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 },
      ]],
      diagnostics: [],
    });
  });

  it("includes exact bounds for sin and explicit-x orientation", () => {
    const sin = generateExplicit2DGeometry(equation("y = sin(x)"), { xMin: 0, xMax: Math.PI, yMin: -1, yMax: 1 }, { sampleCount: 5 });
    expect(sin.segments[0]?.[0]).toEqual({ x: 0, y: 0 });
    expect(sin.segments[0]?.at(-1)?.x).toBe(Math.PI);
    expect(sin.segments[0]?.at(-1)?.y).toBeCloseTo(0);
    expect(generateExplicit2DGeometry(equation("x = y^2"), { xMin: -10, xMax: 10, yMin: -2, yMax: 2 }, { sampleCount: 5 }).segments).toEqual([[
      { x: 4, y: -2 }, { x: 1, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 2 },
    ]]);
  });

  it("overrides sampled coordinates without mutating bindings and resolves parameters", () => {
    const bindings = { x: 999, a: 2 };
    const result = generateExplicit2DGeometry(equation("y = a*x"), { xMin: 0, xMax: 2, yMin: -1, yMax: 5 }, { bindings, sampleCount: 3 });
    expect(result.segments[0]).toEqual([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
    expect(bindings).toEqual({ x: 999, a: 2 });
  });

  it.each([
    [{ xMin: Number.NaN, xMax: 1, yMin: 0, yMax: 1 }],
    [{ xMin: 0, xMax: 0, yMin: 0, yMax: 1 }],
    [{ xMin: 1, xMax: 0, yMin: 0, yMax: 1 }],
  ])("rejects invalid viewport %j", (viewport) => {
    expect(generateExplicit2DGeometry(equation("y = x"), viewport).diagnostics[0]?.code).toBe("invalid-viewport");
  });

  it.each([1, 513, 2.5])("rejects invalid sample count %s", (sampleCount) => {
    expect(generateExplicit2DGeometry(equation("y = x"), { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, { sampleCount }).diagnostics[0]?.code).toBe("invalid-sample-count");
  });

  it("rejects unsupported forms", () => {
    expect(generateExplicit2DGeometry(equation("x^2 + y^2 = 1"), { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }).diagnostics[0]?.code).toBe("unsupported-equation-form");
  });

  it("breaks local gaps and omits isolated points", () => {
    const discontinuity = generateExplicit2DGeometry(equation("y = 1/x"), { xMin: -1, xMax: 1, yMin: -10, yMax: 10 }, { sampleCount: 5 });
    expect(discontinuity.segments).toEqual([
      [{ x: -1, y: -1 }, { x: -0.5, y: -2 }],
      [{ x: 0.5, y: 2 }, { x: 1, y: 1 }],
    ]);
    expect(discontinuity.diagnostics).toEqual([]);
    expect(generateExplicit2DGeometry(equation("y = sqrt(x)"), { xMin: -1, xMax: 1, yMin: 0, yMax: 1 }, { sampleCount: 5 }).segments).toEqual([[
      { x: 0, y: 0 }, { x: 0.5, y: Math.sqrt(0.5) }, { x: 1, y: 1 },
    ]]);
  });

  it("reports no visible geometry and fatal evaluator failures", () => {
    expect(generateExplicit2DGeometry(equation("y = 1/x"), { xMin: 0, xMax: 1, yMin: -1, yMax: 1 }, { sampleCount: 2 })).toEqual({
      segments: [], diagnostics: [{ code: "no-visible-geometry", message: "No visible geometry." }],
    });
    const missing = generateExplicit2DGeometry(equation("y = a*x"), { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, { sampleCount: 3 });
    expect(missing.segments).toEqual([]);
    expect(missing.diagnostics[0]).toMatchObject({ code: "evaluation-failed", cause: { code: "missing-binding" } });
    expect(generateExplicit2DGeometry(equation("y = a*x"), { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, { bindings: { a: Number.NaN }, sampleCount: 3 }).diagnostics[0]).toMatchObject({
      code: "evaluation-failed", cause: { code: "invalid-binding" },
    });
  });

  it("discards partial geometry when the evaluator budget is exceeded", () => {
    let expression: MathExpression = { kind: "number", raw: "1", start: 0, end: 1 };
    for (let index = 0; index < 2048; index += 1) {
      expression = { kind: "group", expression, start: 0, end: 1 };
    }
    const synthetic: MathSemanticEquation = {
      kind: "equation",
      form: "explicit-y",
      equation: { kind: "equation", left: { kind: "identifier", name: "y", start: 0, end: 1 }, right: expression, start: 0, end: 1 },
      coordinates: ["y"],
      parameters: [],
      start: 0,
      end: 1,
    };
    const result = generateExplicit2DGeometry(synthetic, { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, { sampleCount: 2 });
    expect(result.segments).toEqual([]);
    expect(result.diagnostics[0]).toMatchObject({ code: "evaluation-failed", cause: { code: "evaluation-budget-exceeded" } });
  });

  it("emits only finite coordinates", () => {
    const result = generateExplicit2DGeometry(equation("y = sin(x)"), { xMin: -2, xMax: 2, yMin: -1, yMax: 1 }, { sampleCount: 9 });
    expect(result.segments.flat().every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });
});
