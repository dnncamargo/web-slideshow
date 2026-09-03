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
        { type: "text", value: "Move " }, { type: "value", content: [{ type: "text", value: "10" }] },
        { type: "text", value: " steps " }, { type: "variable", value: "x" },
        { type: "text", value: " " }, { type: "logic", content: [
          { type: "text", value: "> " }, { type: "value", content: [{ type: "text", value: "5" }] },
        ] },
      ] },
    ]);
  });

  it("parses the eight optional categories on colorable commands", () => {
    const categories = ["events", "output", "control", "input", "math", "variables"] as const;
    for (const category of categories) {
      expect(ok(`\\statement[${category}](Text)`)[0]).toMatchObject({ type: "statement", category });
    }
  });

  it("keeps categories transient and supports categorized scopes, ends, and logic", () => {
    expect(ok(String.raw`\start[events](Start)\scope[control](Repeat){\end[output](End)}\statement(Check \logic[input](Touching))`)).toEqual([
      { type: "start", category: "events", content: [{ type: "text", value: "Start" }] },
      { type: "scope", category: "control", content: [{ type: "text", value: "Repeat" }], children: [
        { type: "end", category: "output", content: [{ type: "text", value: "End" }] },
      ] },
      { type: "statement", content: [
        { type: "text", value: "Check " },
        { type: "logic", category: "input", content: [{ type: "text", value: "Touching" }] },
      ] },
    ]);
    expect(ok("\\statement(Text)")[0]).toEqual({ type: "statement", content: [{ type: "text", value: "Text" }] });
  });

  it("supports nested logic and preserves multiline authored text", () => {
    const blocks = ok("\\statement(outer \\logic(\\variable(x) > \\value(10)) and inner)");
    expect(blocks[0]).toEqual({ type: "statement", content: [
      { type: "text", value: "outer " },
      { type: "logic", content: [
        { type: "variable", value: "x" }, { type: "text", value: " > " }, { type: "value", content: [{ type: "text", value: "10" }] },
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
        { type: "text", value: "Use (A) {x} C:\\Temp " }, { type: "value", content: [{ type: "text", value: "90°" }] },
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
    ["\\foo(A)", 'Unknown command "\\foo".'],
    ["\\Start(A)", 'Unknown command "\\Start".'],
    ["hello", "Unexpected text outside a Blocks command."],
    ["\\value(5)", 'Inline command "\\value" is not allowed here.'],
    ["\\scope(A){\\value(5)}", 'Inline command "\\value" is not allowed here.'],
    ["\\statement(\\statement(x))", 'Vertical command "\\statement" is not allowed in inline content.'],
    ["\\statement(\\scope(x){})", 'Vertical command "\\scope" is not allowed in inline content.'],
    ["\\statement(\\variable(\\value(x)))", 'Commands are not allowed inside "\\variable".'],
    ["\\statement(A", 'Expected ")" to close "\\statement".'],
    ["\\scope(A)", 'Expected "{" after "\\scope(...)".'],
    ["\\scope(A){", 'Expected "}" to close "\\scope".'],
    ["}", "Unexpected delimiter."], ["{", "Unexpected delimiter."], [")", "Unexpected delimiter."], ["(", "Unexpected delimiter."],
    ["\\statement(\\!)", 'Invalid escape "\\!".'],
    ["\\statement(\\statement123(x))", 'Vertical command "\\statement" is not allowed in inline content.'],
    ["\\statement[](x)", "Invalid Blocks annotation."],
    ["\\statement[foo](x)", "Unknown Blocks category \"foo\"."],
    ["\\statement[Motion](x)", "Unknown Blocks category \"Motion\"."],
    ["\\statement[output(x)", 'Expected "]" after annotation for "\\statement".'],
    ["\\statement[output] (x)", 'Expected "(" after "\\statement".'],
    ["\\statement[output,color=#e11d48] (x)", 'Expected "(" after "\\statement".'],
    ["\\statement[output,color=#e11d48,foo](x)", "Invalid Blocks annotation."],
    ["\\statement[color=#e11d48,output](x)", "Blocks category must precede color."],
    ["\\statement[output,color=#12](x)", "Invalid Blocks color annotation."],
    ["\\statement[output, color=#fff](x)", "Whitespace is not allowed in annotations."],
    ["\\statement[output,color =#fff](x)", "Whitespace is not allowed in annotations."],
    ["\\statement[output,color=#fff,color=#000](x)", "Invalid Blocks annotation."],
  ])("reports the stable diagnostic for invalid source: %s", (source, message) => {
    expect(error(source).message).toBe(message);
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

  it("keeps square brackets in authored text ordinary", () => {
    expect(ok("\\statement(Use array[0] and Text [example])")).toEqual([
      { type: "statement", content: [{ type: "text", value: "Use array[0] and Text [example]" }] },
    ]);
  });

  it("parses all categories, local colors, composed values, and options", () => {
    const blocks = ok(String.raw`\statement[output,color=#e11d48](Set \value[input](Pino \[13\] \value[math](2)) \variable[variables,color=#ff0](x) \logic[math,color=#22c55e](x = \value(1)))`);
    expect(blocks[0]).toMatchObject({ type: "statement", category: "output", color: "#e11d48" });
    expect(blocks[0]?.content).toEqual([
      { type: "text", value: "Set " },
      { type: "value", category: "input", content: [
        { type: "text", value: "Pino " }, { type: "option", value: "13" }, { type: "text", value: " " },
        { type: "value", category: "math", content: [{ type: "text", value: "2" }] },
      ] },
      { type: "text", value: " " }, { type: "variable", category: "variables", color: "#ff0", value: "x" },
      { type: "text", value: " " }, { type: "logic", category: "math", color: "#22c55e", content: [{ type: "text", value: "x = " }, { type: "value", content: [{ type: "text", value: "1" }] }] },
    ]);
  });

  it("rejects removed categories and malformed option/color annotations", () => {
    expect(error("\\statement[motion](x)").message).toBe('Unknown Blocks category "motion".');
    expect(error(String.raw`\statement[color=#12](x)`).message).toBe("Invalid Blocks color annotation.");
    expect(error(String.raw`\statement[output,color=#gg0000](x)`).message).toBe("Invalid Blocks color annotation.");
    expect(error(String.raw`\statement(Choose \[13)`).message).toBe('Expected "\\]" to close option.');
  });
});
