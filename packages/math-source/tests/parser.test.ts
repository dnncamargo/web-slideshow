import { describe, expect, it } from "vitest";
import { parseMathSource, type MathExpression } from "../src";

const only = (source: string) => {
  const result = parseMathSource(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.program.statements).toHaveLength(1);
  return result.program.statements[0]!;
};

describe("parseMathSource", () => {
  it("parses empty and blank-line-only programs", () => {
    expect(parseMathSource("")).toEqual({
      program: { kind: "program", statements: [], start: 0, end: 0 },
      diagnostics: [],
    });
    expect(parseMathSource("\n\r\n")).toEqual({
      program: { kind: "program", statements: [], start: 0, end: 3 },
      diagnostics: [],
    });
  });

  it("parses the supported equation and call forms", () => {
    expect(only("x = 2")).toEqual({
      kind: "equation", left: { kind: "identifier", name: "x", start: 0, end: 1 },
      right: { kind: "number", raw: "2", start: 4, end: 5 }, start: 0, end: 5,
    });
    expect(only("x^2 + y^2 = 1").left).toEqual({
      kind: "binary", operator: "+",
      left: { kind: "binary", operator: "^", left: { kind: "identifier", name: "x", start: 0, end: 1 }, right: { kind: "number", raw: "2", start: 2, end: 3 }, start: 0, end: 3 },
      right: { kind: "binary", operator: "^", left: { kind: "identifier", name: "y", start: 6, end: 7 }, right: { kind: "number", raw: "2", start: 8, end: 9 }, start: 6, end: 9 }, start: 0, end: 9,
    });
    expect(only("z = sin(x) * cos(y)").right).toMatchObject({
      kind: "binary", operator: "*", start: 4, end: 19,
      left: { kind: "call", callee: "sin", start: 4, end: 10, argument: { kind: "identifier", name: "x" } },
      right: { kind: "call", callee: "cos", start: 13, end: 19, argument: { kind: "identifier", name: "y" } },
    });
    expect(only("y = (x + 1) * 2").right).toMatchObject({
      kind: "binary", operator: "*", start: 4, end: 15,
      left: { kind: "group", start: 4, end: 11 },
    });
    expect(only("y = sin(cos(x))").right).toMatchObject({
      kind: "call", callee: "sin", start: 4, end: 15,
      argument: { kind: "call", callee: "cos", start: 8, end: 14 },
    });
  });

  it("freezes additive, exponent, and unary precedence", () => {
    expect(only("a = 1 + 2 * 3").right).toMatchObject({
      kind: "binary", operator: "+", left: { kind: "number", raw: "1" },
      right: { kind: "binary", operator: "*", left: { kind: "number", raw: "2" }, right: { kind: "number", raw: "3" } },
    });
    expect(only("a = 2 ^ 3 ^ 2").right).toMatchObject({
      kind: "binary", operator: "^", left: { kind: "number", raw: "2" },
      right: { kind: "binary", operator: "^", left: { kind: "number", raw: "3" }, right: { kind: "number", raw: "2" } },
    });
    expect(only("a = -2 ^ 2").right).toMatchObject({
      kind: "unary", operator: "-", operand: { kind: "binary", operator: "^" },
    });
    expect(only("a = 2 ^ -2").right).toMatchObject({
      kind: "binary", operator: "^", right: { kind: "unary", operator: "-", operand: { kind: "number", raw: "2" } },
    });
  });

  it("retains exact authored spans and raw numbers", () => {
    const statement = only(" y = - (x + 1.50) ");
    expect(statement).toEqual({
      kind: "equation", start: 1, end: 17,
      left: { kind: "identifier", name: "y", start: 1, end: 2 },
      right: {
        kind: "unary", operator: "-", start: 5, end: 17,
        operand: {
          kind: "group", start: 7, end: 17,
          expression: {
            kind: "binary", operator: "+", start: 8, end: 16,
            left: { kind: "identifier", name: "x", start: 8, end: 9 },
            right: { kind: "number", raw: "1.50", start: 12, end: 16 },
          },
        },
      },
    });
  });

  it("recovers at newlines and retains tokenizer diagnostics", () => {
    const recovered = parseMathSource("y =\nx = 2");
    expect(recovered.program.statements).toHaveLength(1);
    expect(recovered.program.statements[0]!.left).toMatchObject({ name: "x" });
    expect(recovered.diagnostics).toMatchObject([{ code: "expected-token", start: 3, end: 4 }]);
    expect(parseMathSource("x @ = 2").diagnostics).toMatchObject([
      { code: "unexpected-character", start: 2, end: 3 },
    ]);
  });

  it("diagnoses invalid logical lines without throwing", () => {
    const result = parseMathSource("x + 1\nx =\n= 2\ny = (x + 1\ny = x)\nx = y = 2\ny = sin()\ny = f(x, y)\n()\n+\n^\n=");
    expect(result.program.statements).toEqual([]);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(11);
  });

  it("uses UTF-16 spans after unsupported surrogate pairs", () => {
    const result = parseMathSource("😀\nx = 2");
    expect(result.program.statements[0]).toMatchObject({ start: 3, end: 8 });
    expect(result.program.statements[0]!.right).toMatchObject({ start: 7, end: 8 });
    expect(result.diagnostics).toMatchObject([{ code: "unexpected-character", start: 0, end: 2 }]);
  });

  it("limits recursive parser nesting to 128", () => {
    const source = `x = ${"(".repeat(130)}1${")".repeat(130)}`;
    expect(() => parseMathSource(source)).not.toThrow();
    expect(parseMathSource(source).diagnostics).toMatchObject([
      { code: "nesting-limit-exceeded" },
    ]);
  });

  it("keeps all identifiers syntactic", () => {
    const expression: MathExpression = only("foo(bar) = baz").left;
    expect(expression).toMatchObject({ kind: "call", callee: "foo", argument: { kind: "identifier", name: "bar" } });
  });
});
