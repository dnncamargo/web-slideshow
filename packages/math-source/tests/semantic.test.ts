import { describe, expect, it } from "vitest";
import { analyzeMathSource } from "../src";

function equation(source: string) {
  const result = analyzeMathSource(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.equations).toHaveLength(1);
  return result.equations[0]!;
}

describe("analyzeMathSource", () => {
  it.each([
    ["y = x^2", "explicit-y", ["y", "x"], []],
    ["y = sin(x)", "explicit-y", ["y", "x"], []],
    ["y = a*x + b", "explicit-y", ["y", "x"], ["a", "b"]],
    ["x = 2", "explicit-x", ["x"], []],
    ["x = y^2", "explicit-x", ["x", "y"], []],
    ["z = sin(x) * cos(y)", "explicit-z", ["z", "x", "y"], []],
    ["x^2 + y^2 = 1", "implicit-2d", ["x", "y"], []],
    ["sin(x) = y", "implicit-2d", ["x", "y"], []],
    ["x = x + 1", "implicit-2d", ["x"], []],
    ["x^2 + y^2 + z^2 = 1", "implicit-3d", ["x", "y", "z"], []],
    ["z = z + 1", "implicit-3d", ["z"], []],
  ])("classifies %s", (source, form, coordinates, parameters) => {
    expect(equation(source)).toMatchObject({ form, coordinates, parameters, start: 0, end: source.length });
  });

  it("collects constants and contextual function names", () => {
    expect(equation("y = pi*x + e").parameters).toEqual([]);
    expect(equation("y = a*pi + e").parameters).toEqual(["a"]);
    expect(equation("y = sin").parameters).toEqual(["sin"]);
    expect(equation("y = sin(x)").parameters).toEqual([]);
  });

  it("collects identifiers from both sides in source order", () => {
    expect(equation("a*x + b = y + c")).toMatchObject({
      coordinates: ["x", "y"],
      parameters: ["a", "b", "c"],
    });
  });

  it.each(["y = unknown(x)", "y = pi(x)"])('rejects unknown function in "%s"', (source) => {
    const result = analyzeMathSource(source);
    expect(result.equations).toEqual([]);
    expect(result.diagnostics).toMatchObject([{ code: "unknown-function", start: 4, end: source.startsWith("y = pi") ? 6 : 11 }]);
  });

  it("recovers valid equations alongside semantic failures", () => {
    const result = analyzeMathSource("y = unknown(x)\nx = 2");
    expect(result.equations).toHaveLength(1);
    expect(result.equations[0]).toMatchObject({ form: "explicit-x", start: 15, end: 20 });
    expect(result.diagnostics).toMatchObject([{ code: "unknown-function", start: 4, end: 11 }]);
  });

  it.each(["a = b", "pi = e", "a = 2"])("diagnoses coordinate-free equation %s", (source) => {
    const result = analyzeMathSource(source);
    expect(result.equations).toEqual([]);
    expect(result.diagnostics).toEqual([{
      code: "equation-has-no-coordinate",
      message: "Equation has no coordinate.",
      start: 0,
      end: source.length,
    }]);
  });

  it("preserves parser and tokenizer diagnostics", () => {
    const parsed = analyzeMathSource("y =\nx = 2");
    expect(parsed.diagnostics).toMatchObject([{ code: "expected-token", start: 3, end: 4 }]);
    expect(parsed.equations).toMatchObject([{ form: "explicit-x" }]);

    expect(analyzeMathSource("x @ = 2").diagnostics).toMatchObject([
      { code: "unexpected-character", start: 2, end: 3 },
    ]);
  });
});
