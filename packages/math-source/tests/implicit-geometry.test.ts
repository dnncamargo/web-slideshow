import { describe, expect, it } from "vitest";
import { analyzeMathSource, generateImplicit2DGeometry, type MathSemanticEquation } from "../src";

function equation(source: string): MathSemanticEquation {
  const result = analyzeMathSource(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.equations).toHaveLength(1);
  return result.equations[0]!;
}

describe("generateImplicit2DGeometry", () => {
  it("emits a deterministic linear contour with expected intersections", () => {
    const result = generateImplicit2DGeometry(equation("x + y = 0.2"), { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, { gridWidth: 1, gridHeight: 1 });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.[0]?.x).toBeCloseTo(0.2);
    expect(result.segments[0]?.[0]?.y).toBe(0);
    expect(result.segments[0]?.[1]?.x).toBe(0);
    expect(result.segments[0]?.[1]?.y).toBeCloseTo(0.2);
    expect(result.diagnostics).toEqual([]);
  });

  it("generates finite deterministic circle geometry", () => {
    const viewport = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };
    const first = generateImplicit2DGeometry(equation("x^2 + y^2 = 1"), viewport, { gridWidth: 16, gridHeight: 16 });
    const second = generateImplicit2DGeometry(equation("x^2 + y^2 = 1"), viewport, { gridWidth: 16, gridHeight: 16 });
    expect(first).toEqual(second);
    expect(first.segments.length).toBeGreaterThan(0);
    expect(first.segments.flat().every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it("rejects unsupported forms", () => {
    expect(generateImplicit2DGeometry(equation("y = x^2"), { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }).diagnostics[0]?.code).toBe("unsupported-equation-form");
  });

  it.each([
    { xMin: Number.NaN, xMax: 1, yMin: 0, yMax: 1 },
    { xMin: 0, xMax: 0, yMin: 0, yMax: 1 },
    { xMin: 1, xMax: 0, yMin: 0, yMax: 1 },
  ])("rejects invalid viewport %j", (viewport) => {
    expect(generateImplicit2DGeometry(equation("x + y = 0"), viewport).diagnostics[0]?.code).toBe("invalid-viewport");
  });

  it.each([
    { gridWidth: 0, gridHeight: 1 },
    { gridWidth: 65, gridHeight: 1 },
    { gridWidth: 2.5, gridHeight: 1 },
  ])("rejects invalid grid dimensions %j", (options) => {
    expect(generateImplicit2DGeometry(equation("x + y = 0"), { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, options).diagnostics[0]?.code).toBe("invalid-grid");
  });

  it("enforces the total vertex budget", () => {
    const contour = equation("x + y = 0");
    expect(generateImplicit2DGeometry(contour, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, { gridWidth: 44, gridHeight: 44 }).diagnostics).toEqual([]);
    expect(generateImplicit2DGeometry(contour, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, { gridWidth: 45, gridHeight: 45 }).diagnostics[0]?.code).toBe("geometry-budget-exceeded");
  });

  it("overrides caller coordinates and resolves parameters", () => {
    const bindings = { x: 999, y: 999, a: 0.2 };
    const result = generateImplicit2DGeometry(equation("x + y = a"), { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, { bindings, gridWidth: 1, gridHeight: 1 });
    expect(result.segments[0]?.[0]?.x).toBeCloseTo(0.2);
    expect(bindings).toEqual({ x: 999, y: 999, a: 0.2 });
  });

  it("returns fatal diagnostics for missing and invalid parameters", () => {
    const viewport = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
    expect(generateImplicit2DGeometry(equation("x + y = a"), viewport, { gridWidth: 1, gridHeight: 1 }).diagnostics[0]).toMatchObject({ code: "evaluation-failed", cause: { code: "missing-binding" } });
    expect(generateImplicit2DGeometry(equation("x + y = a"), viewport, { bindings: { a: Infinity }, gridWidth: 1, gridHeight: 1 }).diagnostics[0]).toMatchObject({ code: "evaluation-failed", cause: { code: "invalid-binding" } });
  });

  it("skips local invalid vertices while retaining surviving geometry", () => {
    const result = generateImplicit2DGeometry(equation("1 / x + y = 0"), { xMin: -1, xMax: 1, yMin: -2, yMax: 2 }, { gridWidth: 4, gridHeight: 4 });
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual([]);
  });

  it("reports no visible geometry", () => {
    expect(generateImplicit2DGeometry(equation("x^2 + y^2 = 100"), { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }).diagnostics).toEqual([{ code: "no-visible-geometry", message: "No visible geometry." }]);
  });

  it("uses the fixed ambiguous-cell topology and ordering", () => {
    const result = generateImplicit2DGeometry(equation("x * y = 0.1"), { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, { gridWidth: 1, gridHeight: 1 });
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]?.[0]?.x).toBeCloseTo(-0.1);
    expect(result.segments[0]?.[0]?.y).toBe(-1);
    expect(result.segments[0]?.[1]?.x).toBe(1);
    expect(result.segments[0]?.[1]?.y).toBeCloseTo(0.1);
    expect(result.segments[1]?.[0]?.x).toBeCloseTo(0.1);
    expect(result.segments[1]?.[0]?.y).toBe(1);
    expect(result.segments[1]?.[1]?.x).toBe(-1);
    expect(result.segments[1]?.[1]?.y).toBeCloseTo(-0.1);
  });
});
