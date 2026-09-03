import { describe, expect, it } from "vitest";
import { parseBlocksSource, type BlocksAstNode } from "../src";

const ok = (source: string): BlocksAstNode[] => {
  const result = parseBlocksSource(source);
  if (!result.ok) throw new Error(result.error.message);
  return result.blocks;
};

const error = (source: string) => {
  const result = parseBlocksSource(source);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected a syntax error");
  return result.error;
};

describe("parseBlocksSource", () => {
  it("accepts empty and whitespace-only documents", () => {
    expect(ok("")).toEqual([]);
    expect(ok(" \n\t ")).toEqual([]);
  });

  it("parses the four vertical commands and empty content", () => {
    expect(ok("\\start()\\statement()\\scope(){}\\end()")).toEqual([
      { type: "start", content: [] },
      { type: "statement", content: [] },
      { type: "scope", content: [], children: [] },
      { type: "end", content: [] },
    ]);
  });

  it("parses mixed text, values, variables, and logic", () => {
    expect(ok("\\statement(Move \\value(10) steps \\variable(x) \\logic(> \\value(5)))")).toEqual([
      { type: "statement", content: [
        { type: "text", value: "Move " }, { type: "value", value: "10" },
        { type: "text", value: " steps " }, { type: "variable", value: "x" },
        { type: "text", value: " " }, { type: "logic", content: [
          { type: "text", value: "> " }, { type: "value", value: "5" },
        ] },
      ] },
    ]);
  });

  it("supports nested logic and preserves multiline authored text", () => {
    const blocks = ok("\\statement(outer \\logic(\\variable(x) > \\value(10)) and inner)");
    expect(blocks[0]).toEqual({ type: "statement", content: [
      { type: "text", value: "outer " },
      { type: "logic", content: [
        { type: "variable", value: "x" }, { type: "text", value: " > " }, { type: "value", value: "10" },
    ] }, { type: "text", value: " and inner" },
    ] });
    expect(ok("\\statement(\n  Define\n  \\variable(x)\n)")[0]).toEqual({ type: "statement", content: [
      { type: "text", value: "\n  Define\n  " }, { type: "variable", value: "x" }, { type: "text", value: "\n" },
    ] });
  });

  it("parses nested scopes and keeps child order, including unusual visual order", () => {
    expect(ok("\\end(A)\\scope(Outer){\\start(B)\\scope(Inner){\\statement(C)}\\end(D)}\\start(E)")).toEqual([
      { type: "end", content: [{ type: "text", value: "A" }] },
      { type: "scope", content: [{ type: "text", value: "Outer" }], children: [
        { type: "start", content: [{ type: "text", value: "B" }] },
        { type: "scope", content: [{ type: "text", value: "Inner" }], children: [{ type: "statement", content: [{ type: "text", value: "C" }] }] },
        { type: "end", content: [{ type: "text", value: "D" }] },
      ] },
      { type: "start", content: [{ type: "text", value: "E" }] },
    ]);
  });

  it("allows whitespace before a scope body", () => {
    expect(ok("\\scope(Repeat)\n {\n \\statement(Move)\n}")).toHaveLength(1);
  });

  it("decodes and coalesces the five supported escapes", () => {
    expect(ok("\\statement(Use \\(A\\) \\{x\\} C:\\\\Temp \\value(90°))")).toEqual([
      { type: "statement", content: [
        { type: "text", value: "Use (A) {x} C:\\Temp " }, { type: "value", value: "90°" },
      ] },
    ]);
  });

  it("preserves Unicode and parses a complete didactic source", () => {
    const blocks = ok(String.raw`\start(Quando a bandeira 🚩 for clicada)
\scope(Repita \value(5) vezes){
  \statement(Definir \variable(varpot) como \logic(Ler pino digital \value(2)))
}
\end(Parar todos)`);
    expect(blocks.map((block) => block.type)).toEqual(["start", "scope", "end"]);
    expect(blocks[1]).toMatchObject({ type: "scope", children: [{ type: "statement" }] });
  });

  it.each([
    "\\foo(A)", "\\Start(A)", "hello", "\\value(5)", "\\variable(x)", "\\logic(x)",
    "\\scope(A){hello}", "\\scope(A){\\value(5)}", "\\statement(\\statement(x))",
    "\\statement(\\scope(x){})", "\\value(\\variable(x))", "\\variable(\\value(x))",
    "\\statement(A", "\\logic(A", "\\value(A", "\\scope(A)", "\\scope(A){",
    "}", "{", "\\statement(\\q)", "\\statement(\\statement123(x))",
  ])("reports invalid source: %s", (source) => {
    expect(error(source).message.length).toBeGreaterThan(0);
  });

  it("returns the first error with zero-based UTF-16 offset and one-based line/column", () => {
    expect(error("\n  hello\n\\foo(A)")).toMatchObject({ offset: 3, line: 2, column: 3 });
    expect(error("\\statement(A")).toMatchObject({ offset: 12, line: 1, column: 13 });
    expect(error("\\statement(\n  \\statement(x)")).toMatchObject({ offset: 24, line: 2, column: 13 });
  });

  it("returns structurally equivalent results without mutating input", () => {
    const source = "\\statement(hello)";
    expect(parseBlocksSource(source)).toEqual(parseBlocksSource(source));
    expect(source).toBe("\\statement(hello)");
  });
});
