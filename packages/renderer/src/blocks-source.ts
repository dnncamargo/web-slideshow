export type BlocksCategory = "events" | "output" | "control" | "input" | "math" | "variables";
export type BlocksAstNode =
  | { type: "start" | "statement" | "end"; category?: BlocksCategory; color?: string; content: BlocksInlineNode[] }
  | { type: "scope"; category?: BlocksCategory; color?: string; content: BlocksInlineNode[]; children: BlocksAstNode[] };
export type BlocksInlineNode =
  | { type: "text"; value: string }
  | { type: "value"; category?: BlocksCategory; color?: string; content: BlocksInlineNode[] }
  | { type: "variable"; category?: BlocksCategory; color?: string; value: string }
  | { type: "logic"; category?: BlocksCategory; color?: string; content: BlocksInlineNode[] }
  | { type: "option"; value: string };
export interface BlocksSourceSyntaxError { message: string; offset: number; line: number; column: number; }
export type BlocksSourceParseResult = { ok: true; blocks: BlocksAstNode[] } | { ok: false; error: BlocksSourceSyntaxError };
type VerticalCommand = "start" | "statement" | "scope" | "end";
type InlineCommand = "value" | "variable" | "logic";
type Command = VerticalCommand | InlineCommand;
const BLOCKS_CATEGORIES: readonly BlocksCategory[] = ["events", "output", "control", "input", "math", "variables"];

class BlocksSourceParser {
  private index = 0;
  constructor(private readonly source: string) {}
  parse(): BlocksSourceParseResult { try { return { ok: true, blocks: this.parseDocument() }; } catch (error) { if (error instanceof BlocksSourceParseFailure) return { ok: false, error: error.error }; throw error; } }
  private parseDocument(): BlocksAstNode[] { const blocks: BlocksAstNode[] = []; this.skipWhitespace(); while (!this.atEnd()) { if (this.peek() !== "\\") { if (this.isDelimiter(this.peek())) this.fail("Unexpected delimiter."); this.fail("Unexpected text outside a Blocks command."); } blocks.push(this.parseBlock()); this.skipWhitespace(); } return blocks; }
  private parseBlock(): BlocksAstNode {
    const command = this.readCommand(); if (!this.isVertical(command)) this.fail(`Inline command "\\${command}" is not allowed here.`);
    const annotation = this.parseAnnotation(command); this.expectOpenParenthesis(command); const content = this.parseInlineSequence(command); this.expect(")", `Expected ")" to close "\\${command}".`);
    if (command !== "scope") return this.withAnnotation({ type: command, content }, annotation);
    this.skipWhitespace(); if (this.peek() !== "{") this.fail(`Expected "{" after "\\scope(...)".`); this.index += 1;
    const children: BlocksAstNode[] = []; this.skipWhitespace(); while (!this.atEnd() && this.peek() !== "}") { if (this.peek() !== "\\") { if (this.isDelimiter(this.peek())) this.fail("Unexpected delimiter."); this.fail("Unexpected text inside a scope body."); } children.push(this.parseBlock()); this.skipWhitespace(); }
    if (this.atEnd()) this.fail('Expected "}" to close "\\scope".'); this.index += 1; return this.withAnnotation({ type: "scope", content, children }, annotation);
  }
  private parseInlineSequence(owner: Command): BlocksInlineNode[] {
    const nodes: BlocksInlineNode[] = []; let text = ""; const flushText = () => { if (text.length > 0) nodes.push({ type: "text", value: text }); text = ""; };
    while (!this.atEnd() && this.peek() !== ")") {
      if (this.peek() === "\\") {
        if (this.source[this.index + 1] === "[") { flushText(); nodes.push(this.parseOption()); continue; }
        const escaped = this.source[this.index + 1]; if (escaped === "\\" || escaped === "(" || escaped === ")" || escaped === "{" || escaped === "}") { text += escaped; this.index += 2; continue; }
        flushText(); const command = this.readCommand(); if (this.isVertical(command)) this.fail(`Vertical command "\\${command}" is not allowed in inline content.`); const annotation = this.parseAnnotation(command); this.expectOpenParenthesis(command);
        if (command === "variable") { const value = this.parseAtomic(command); this.expect(")", `Expected ")" to close "\\${command}".`); nodes.push(this.withAnnotation({ type: "variable", value }, annotation)); }
        else { const content = this.parseInlineSequence(command); this.expect(")", `Expected ")" to close "\\${command}".`); nodes.push(this.withAnnotation({ type: command, content }, annotation)); }
        continue;
      }
      if (this.isDelimiter(this.peek())) this.fail("Unexpected delimiter."); text += this.peek(); this.index += 1;
    }
    flushText(); if (this.atEnd()) this.fail(`Expected ")" to close "\\${owner}".`); return nodes;
  }
  private parseOption(): BlocksInlineNode { const start = this.index; this.index += 2; let value = ""; while (!this.atEnd()) { if (this.peek() === "\\" && this.source[this.index + 1] === "]") { this.index += 2; return { type: "option", value }; } if (this.peek() === "\\") this.fail("Commands are not allowed inside an option."); value += this.peek(); this.index += 1; } this.fail('Expected "\\]" to close option.', start); }
  private parseAtomic(command: "variable"): string { let value = ""; while (!this.atEnd() && this.peek() !== ")") { if (this.peek() === "\\") { const next = this.source[this.index + 1]; if (next === "\\" || next === "(" || next === ")" || next === "{" || next === "}") { value += next; this.index += 2; continue; } this.fail(`Commands are not allowed inside "\\${command}".`); } if (this.isDelimiter(this.peek())) this.fail("Unexpected delimiter."); value += this.peek(); this.index += 1; } if (this.atEnd()) this.fail(`Expected ")" to close "\\${command}".`); return value; }
  private parseAnnotation(command: Command): { category?: BlocksCategory; color?: string } {
    if (this.peek() !== "[") return {}; const start = this.index; this.index += 1; const parts: string[] = []; let part = "";
    while (!this.atEnd() && this.peek() !== "]") { if (/\s/.test(this.peek())) this.fail("Whitespace is not allowed in annotations."); if (this.peek() === ",") { parts.push(part); part = ""; this.index += 1; continue; } part += this.peek(); this.index += 1; }
    if (this.peek() !== "]") this.fail(`Expected "]" after annotation for "\\${command}".`, start); parts.push(part); this.index += 1; if (parts.length > 2 || parts.some((item) => item.length === 0)) this.fail("Invalid Blocks annotation.", start);
    let category: BlocksCategory | undefined; let color: string | undefined;
    for (const [index, item] of parts.entries()) {
      if (item.startsWith("color=")) { if (index !== 1 && parts.length > 1) this.fail("Blocks category must precede color.", start); if (color !== undefined || !/^color=#[0-9A-Fa-f]{3,4}$|^color=#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/.test(item)) this.fail("Invalid Blocks color annotation.", start); color = item.slice(6); }
      else { if (index !== 0 || category !== undefined || item.includes("=")) this.fail("Invalid Blocks annotation.", start); if (!BLOCKS_CATEGORIES.includes(item as BlocksCategory)) this.fail(`Unknown Blocks category "${item}".`, start); category = item as BlocksCategory; }
    }
    const annotation: { category?: BlocksCategory; color?: string } = {};
    if (category !== undefined) annotation.category = category;
    if (color !== undefined) annotation.color = color;
    return annotation;
  }
  private withAnnotation<T>(value: T, annotation: { category?: BlocksCategory; color?: string }): T {
    let result = value;
    if (annotation.category !== undefined) result = { ...result, category: annotation.category };
    if (annotation.color !== undefined) result = { ...result, color: annotation.color };
    return result;
  }
  private readCommand(): Command { const slash = this.index; this.index += 1; const start = this.index; while (!this.atEnd() && /[A-Za-z]/.test(this.peek())) this.index += 1; if (this.index === start) this.fail(`Invalid escape "\\${this.source[this.index] ?? ""}".`, slash); const name = this.source.slice(start, this.index); if (!this.isCommand(name)) this.fail(`Unknown command "\\${name}".`, slash); return name; }
  private expectOpenParenthesis(command: Command): void { if (this.peek() !== "(") this.fail(`Expected "(" after "\\${command}".`); this.index += 1; }
  private expect(character: string, message: string): void { if (this.peek() !== character) this.fail(message); this.index += 1; }
  private skipWhitespace(): void { while (!this.atEnd() && /\s/.test(this.peek())) this.index += 1; }
  private peek(): string { return this.source[this.index] ?? ""; }
  private atEnd(): boolean { return this.index >= this.source.length; }
  private fail(message: string, offset = this.index): never { let line = 1; let lineStart = 0; for (let index = 0; index < offset; index += 1) if (this.source[index] === "\n") { line += 1; lineStart = index + 1; } throw new BlocksSourceParseFailure({ message, offset, line, column: offset - lineStart + 1 }); }
  private isVertical(command: Command): command is VerticalCommand { return command === "start" || command === "statement" || command === "scope" || command === "end"; }
  private isCommand(value: string): value is Command { return value === "start" || value === "statement" || value === "scope" || value === "end" || value === "value" || value === "variable" || value === "logic"; }
  private isDelimiter(value: string): boolean { return value === "(" || value === ")" || value === "{" || value === "}"; }
}
class BlocksSourceParseFailure extends Error { constructor(readonly error: BlocksSourceSyntaxError) { super(error.message); } }
export function parseBlocksSource(source: string): BlocksSourceParseResult { return new BlocksSourceParser(source).parse(); }
