import { describe, expect, it } from "vitest";
import type { MathExpression } from "../src/parser";
import { analyzeMathSource, evaluateMathEquation, type MathSemanticEquation } from "../src";

function equation(source: string): MathSemanticEquation {
  const result = analyzeMathSource(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.equations).toHaveLength(1);
  return result.equations[0]!;
}

function evaluate(source: string, bindings: Readonly<Record<string, number>> = {}) {
  return evaluateMathEquation(equation(source), bindings);
}

describe("evaluateMathEquation", () => {
  it.each([
    ["y = x^2", { x: 3 }, 9],
    ["x = y^2", { y: 4 }, 16],
    ["z = x + y", { x: 2, y: 3 }, 5],
    ["y = x + 1", { x: 2 }, 3],
  ])("evaluates explicit equations", (source, bindings, value) => {
    expect(evaluate(source, bindings)).toEqual({ value, diagnostics: [] });
  });

  it("evaluates implicit equations as left minus right", () => {
    expect(evaluate("x^2 + y^2 = 1", { x: 1, y: 0 }).value).toBe(0);
    expect(evaluate("x^2 + y^2 = 1", { x: 0, y: 0 }).value).toBe(-1);
    expect(evaluate("x^2 + y^2 + z^2 = 1", { x: 1, y: 0, z: 0 }).value).toBe(0);
  });

  it("resolves constants and parameters", () => {
    expect(evaluate("y = pi").value).toBe(Math.PI);
    expect(evaluate("y = e").value).toBe(Math.E);
    expect(evaluate("y = 2*pi").value).toBeCloseTo(2 * Math.PI);
    expect(evaluate("y = a*x + b", { a: 2, x: 3, b: 1 }).value).toBe(7);
    expect(evaluate("y = sin", { sin: 5 }).value).toBe(5);
  });

  it("evaluates all supported built-ins", () => {
    expect(evaluate("y = sin(pi / 2)").value).toBeCloseTo(1);
    expect(evaluate("y = cos(0)").value).toBeCloseTo(1);
    expect(evaluate("y = tan(0)").value).toBeCloseTo(0);
    expect(evaluate("y = sqrt(9)").value).toBe(3);
    expect(evaluate("y = abs(-2)").value).toBe(2);
    expect(evaluate("y = log(e)").value).toBeCloseTo(1);
    expect(evaluate("y = exp(1)").value).toBeCloseTo(Math.E);
  });

  it("reports missing bindings at the identifier span", () => {
    const result = evaluate("y = a*x", { x: 2 });
    expect(result.value).toBeNull();
    expect(result.diagnostics).toEqual([{
      code: "missing-binding",
      message: "Missing binding for 'a'.",
      start: 4,
      end: 5,
    }]);
    expect(evaluate("x + y = 1", { x: 1 }).diagnostics[0]?.code).toBe("missing-binding");
  });

  it("rejects invalid read bindings but ignores unused invalid bindings", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(evaluate("y = x", { x: value }).diagnostics[0]?.code).toBe("invalid-binding");
    }
    expect(evaluate("y = x", { x: 2, unused: Number.POSITIVE_INFINITY })).toEqual({ value: 2, diagnostics: [] });
  });

  it("reports domain and division errors without throwing", () => {
    expect(evaluate("y = 1 / 0").diagnostics[0]?.code).toBe("division-by-zero");
    expect(evaluate("y = sqrt(-1)").diagnostics[0]?.code).toBe("invalid-domain");
    expect(evaluate("y = log(0)").diagnostics[0]?.code).toBe("invalid-domain");
    expect(evaluate("y = log(-1)").diagnostics[0]?.code).toBe("invalid-domain");
  });

  it("rejects non-finite results and short-circuits on the first error", () => {
    expect(evaluate("y = exp(10000)").diagnostics[0]?.code).toBe("non-finite-result");
    expect(evaluate("y = a / 0", {}).diagnostics[0]?.code).toBe("missing-binding");
    expect(evaluate("y = (-1)^0.5").diagnostics[0]?.code).toBe("non-finite-result");
  });

  it("uses one shared 2048-step budget for a semantic equation", () => {
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
    expect(evaluateMathEquation(synthetic)).toEqual({
      value: null,
      diagnostics: [{ code: "evaluation-budget-exceeded", message: "Evaluation budget exceeded.", start: 0, end: 1 }],
    });
  });
});
