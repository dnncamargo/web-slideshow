import { describe, expect, it } from "vitest";
import { tokenizeMathSource, type MathToken } from "../src";

const shape = (token: MathToken) => ({
  kind: token.kind,
  lexeme: token.lexeme,
  start: token.start,
  end: token.end,
});

describe("tokenizeMathSource", () => {
  it("tokenizes literals, identifiers, operators, whitespace, and EOF", () => {
    const result = tokenizeMathSource("  42 3.14 value2 some_name + - * / ^ ( ) =\t");
    expect(result.tokens.map(shape)).toEqual([
      { kind: "number", lexeme: "42", start: 2, end: 4 },
      { kind: "number", lexeme: "3.14", start: 5, end: 9 },
      { kind: "identifier", lexeme: "value2", start: 10, end: 16 },
      { kind: "identifier", lexeme: "some_name", start: 17, end: 26 },
      { kind: "plus", lexeme: "+", start: 27, end: 28 },
      { kind: "minus", lexeme: "-", start: 29, end: 30 },
      { kind: "star", lexeme: "*", start: 31, end: 32 },
      { kind: "slash", lexeme: "/", start: 33, end: 34 },
      { kind: "caret", lexeme: "^", start: 35, end: 36 },
      { kind: "left-paren", lexeme: "(", start: 37, end: 38 },
      { kind: "right-paren", lexeme: ")", start: 39, end: 40 },
      { kind: "equals", lexeme: "=", start: 41, end: 42 },
      { kind: "eof", lexeme: "", start: 43, end: 43 },
    ]);
  });

  it("emits logical newlines without normalizing them", () => {
    expect(tokenizeMathSource("y = x^2\r\nx = 2\r").tokens.map(shape)).toEqual([
      { kind: "identifier", lexeme: "y", start: 0, end: 1 },
      { kind: "equals", lexeme: "=", start: 2, end: 3 },
      { kind: "identifier", lexeme: "x", start: 4, end: 5 },
      { kind: "caret", lexeme: "^", start: 5, end: 6 },
      { kind: "number", lexeme: "2", start: 6, end: 7 },
      { kind: "newline", lexeme: "\r\n", start: 7, end: 9 },
      { kind: "identifier", lexeme: "x", start: 9, end: 10 },
      { kind: "equals", lexeme: "=", start: 11, end: 12 },
      { kind: "number", lexeme: "2", start: 13, end: 14 },
      { kind: "newline", lexeme: "\r", start: 14, end: 15 },
      { kind: "eof", lexeme: "", start: 15, end: 15 },
    ]);
    expect(tokenizeMathSource("\n\r\n\r").tokens.filter((token) => token.kind === "newline")).toHaveLength(3);
  });

  it("keeps function-looking names generic and treats signs as operators", () => {
    expect(tokenizeMathSource("z = sin(x) * cos(y)").tokens.map((token) => token.kind)).toEqual([
      "identifier", "equals", "identifier", "left-paren", "identifier",
      "right-paren", "star", "identifier", "left-paren", "identifier",
      "right-paren", "eof",
    ]);
    expect(tokenizeMathSource("-2").tokens.map(shape)).toEqual([
      { kind: "minus", lexeme: "-", start: 0, end: 1 },
      { kind: "number", lexeme: "2", start: 1, end: 2 },
      { kind: "eof", lexeme: "", start: 2, end: 2 },
    ]);
  });

  it("recovers from unsupported characters", () => {
    expect(tokenizeMathSource("x @ y").tokens.map(shape)).toEqual([
      { kind: "identifier", lexeme: "x", start: 0, end: 1 },
      { kind: "identifier", lexeme: "y", start: 4, end: 5 },
      { kind: "eof", lexeme: "", start: 5, end: 5 },
    ]);
    expect(tokenizeMathSource("x @ y").diagnostics).toMatchObject([
      { code: "unexpected-character", start: 2, end: 3 },
    ]);
    expect(tokenizeMathSource("_x").diagnostics).toMatchObject([
      { code: "unexpected-character", start: 0, end: 1 },
    ]);
    expect(tokenizeMathSource("_x").tokens.map(shape)).toEqual([
      { kind: "identifier", lexeme: "x", start: 1, end: 2 },
      { kind: "eof", lexeme: "", start: 2, end: 2 },
    ]);
    expect(tokenizeMathSource("x < 2").diagnostics).toMatchObject([
      { code: "unexpected-character", start: 2, end: 3 },
    ]);
  });

  it("diagnoses malformed decimals without emitting number tokens", () => {
    for (const [source, span] of [["1.", [0, 2]], [".5", [0, 2]]] as const) {
      const result = tokenizeMathSource(source);
      expect(result.tokens.map((token) => token.kind)).toEqual(["eof"]);
      expect(result.diagnostics).toMatchObject([{ code: "invalid-number", start: span[0], end: span[1] }]);
    }
    expect(tokenizeMathSource(".").diagnostics).toMatchObject([
      { code: "unexpected-character", start: 0, end: 1 },
    ]);
  });

  it("uses UTF-16 offsets for unsupported surrogate pairs", () => {
    const result = tokenizeMathSource("x😀@y");
    expect(result.diagnostics).toMatchObject([
      { code: "unexpected-character", start: 1, end: 3 },
      { code: "unexpected-character", start: 3, end: 4 },
    ]);
    expect(result.tokens.map(shape)).toEqual([
      { kind: "identifier", lexeme: "x", start: 0, end: 1 },
      { kind: "identifier", lexeme: "y", start: 4, end: 5 },
      { kind: "eof", lexeme: "", start: 5, end: 5 },
    ]);
  });

  it("retains EOF and enforces 1024 total tokens", () => {
    const boundary = tokenizeMathSource("x ".repeat(1023));
    expect(boundary.tokens).toHaveLength(1024);
    expect(boundary.diagnostics).toEqual([]);
    expect(boundary.tokens.at(-1)).toMatchObject({ kind: "eof", start: 2046, end: 2046 });

    const overflow = tokenizeMathSource("x ".repeat(1024));
    expect(overflow.tokens).toHaveLength(1024);
    expect(overflow.tokens.at(-1)).toMatchObject({ kind: "eof", start: 2046, end: 2046 });
    expect(overflow.diagnostics).toMatchObject([
      { code: "token-limit-exceeded", start: 2046, end: 2047 },
    ]);
  });

  it("tokenizes empty source as one EOF", () => {
    expect(tokenizeMathSource("")).toEqual({
      tokens: [{ kind: "eof", lexeme: "", start: 0, end: 0 }],
      diagnostics: [],
    });
  });
});
