export type BlocksCategory =
  | "events"
  | "motion"
  | "looks"
  | "sound"
  | "control"
  | "sensing"
  | "operators"
  | "variables";

export type BlocksAstNode =
  | { type: "start" | "statement" | "end"; category?: BlocksCategory; content: BlocksInlineNode[] }
  | { type: "scope"; category?: BlocksCategory; content: BlocksInlineNode[]; children: BlocksAstNode[] };

export type BlocksInlineNode =
  | { type: "text"; value: string }
  | { type: "value" | "variable"; value: string }
  | { type: "logic"; category?: BlocksCategory; content: BlocksInlineNode[] };

export interface BlocksSourceSyntaxError {
  message: string;
  offset: number;
  line: number;
  column: number;
}

export type BlocksSourceParseResult =
  | { ok: true; blocks: BlocksAstNode[] }
  | { ok: false; error: BlocksSourceSyntaxError };

type VerticalCommand = "start" | "statement" | "scope" | "end";
type InlineCommand = "value" | "variable" | "logic";
type Command = VerticalCommand | InlineCommand;
const BLOCKS_CATEGORIES: readonly BlocksCategory[] = [
  "events", "motion", "looks", "sound", "control", "sensing", "operators", "variables",
];

class BlocksSourceParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): BlocksSourceParseResult {
    try {
      return { ok: true, blocks: this.parseDocument() };
    } catch (error) {
      if (error instanceof BlocksSourceParseFailure) return { ok: false, error: error.error };
      throw error;
    }
  }

  private parseDocument(): BlocksAstNode[] {
    const blocks: BlocksAstNode[] = [];
    this.skipWhitespace();
    while (!this.atEnd()) {
      if (this.peek() !== "\\") {
        if (this.isDelimiter(this.peek())) this.fail("Unexpected delimiter.");
        this.fail("Unexpected text outside a Blocks command.");
      }
      blocks.push(this.parseBlock());
      this.skipWhitespace();
    }
    return blocks;
  }

  private parseBlock(): BlocksAstNode {
    const command = this.readCommand();
    if (!this.isVertical(command)) this.fail(`Inline command "\\${command}" is not allowed here.`);
    const category = this.parseCategory(command);
    this.expectOpenParenthesis(command);
    const content = this.parseInlineSequence(command);
    this.expect(")", `Expected ")" to close "\\${command}".`);
    if (command !== "scope") return category === undefined ? { type: command, content } : { type: command, category, content };

    this.skipWhitespace();
    if (this.peek() !== "{") this.fail(`Expected "{" after "\\scope(...)".`);
    this.index += 1;
    const children: BlocksAstNode[] = [];
    this.skipWhitespace();
    while (!this.atEnd() && this.peek() !== "}") {
      if (this.peek() !== "\\") {
        if (this.isDelimiter(this.peek())) this.fail("Unexpected delimiter.");
        this.fail("Unexpected text inside a scope body.");
      }
      children.push(this.parseBlock());
      this.skipWhitespace();
    }
    if (this.atEnd()) this.fail('Expected "}" to close "\\scope".');
    this.index += 1;
    return category === undefined ? { type: "scope", content, children } : { type: "scope", category, content, children };
  }

  private parseInlineSequence(owner: Command): BlocksInlineNode[] {
    const nodes: BlocksInlineNode[] = [];
    let text = "";
    const flushText = () => {
      if (text.length > 0) nodes.push({ type: "text", value: text });
      text = "";
    };

    while (!this.atEnd() && this.peek() !== ")") {
      const character = this.peek();
      if (character === "\\") {
        const escaped = this.source[this.index + 1];
        if (escaped === "\\" || escaped === "(" || escaped === ")" || escaped === "{" || escaped === "}") {
          text += escaped;
          this.index += 2;
          continue;
        }
        flushText();
        const command = this.readCommand();
        const category = this.parseCategory(command);
        if (this.isVertical(command)) {
          this.fail(`Vertical command "\\${command}" is not allowed in inline content.`);
        }
        this.expectOpenParenthesis(command);
        if (command === "value" || command === "variable") {
          const value = this.parseAtomic(command);
          this.expect(")", `Expected ")" to close "\\${command}".`);
          nodes.push({ type: command, value });
        } else {
          const content = this.parseInlineSequence(command);
          this.expect(")", `Expected ")" to close "\\${command}".`);
          nodes.push(category === undefined ? { type: "logic", content } : { type: "logic", category, content });
        }
        continue;
      }
      if (character === "(" || character === "{" || character === "}") {
        this.fail("Unexpected delimiter.");
      }
      text += character;
      this.index += 1;
    }
    flushText();
    if (this.atEnd()) this.fail(`Expected ")" to close "\\${owner}".`);
    return nodes;
  }

  private parseAtomic(command: "value" | "variable"): string {
    let value = "";
    while (!this.atEnd() && this.peek() !== ")") {
      const character = this.peek();
      if (character === "\\") {
        const slash = this.index;
        const next = this.source[slash + 1];
        if (next === "\\" || next === "(" || next === ")" || next === "{" || next === "}") {
          value += next;
          this.index += 2;
          continue;
        }
        if (next !== undefined && /[A-Za-z]/.test(next)) {
          this.readCommand();
          this.fail(`Commands are not allowed inside "\\${command}".` , slash);
        }
        this.fail(`Invalid escape "\\${next ?? ""}".`);
      }
      if (character === "(" || character === "{") {
        this.fail("Unexpected delimiter.");
      }
      if (character === "}") this.fail("Unexpected delimiter.");
      value += character;
      this.index += 1;
    }
    if (this.atEnd()) this.fail(`Expected ")" to close "\\${command}".`);
    return value;
  }

  private readCommand(): Command {
    const slash = this.index;
    this.index += 1;
    const start = this.index;
    while (!this.atEnd() && /[A-Za-z]/.test(this.peek())) this.index += 1;
    if (this.index === start) this.fail(`Invalid escape "\\${this.source[this.index] ?? ""}".`, slash);
    const name = this.source.slice(start, this.index);
    if (!this.isCommand(name)) this.fail(`Unknown command "\\${name}".`, slash);
    return name;
  }

  private expectOpenParenthesis(command: Command): void {
    if (this.peek() !== "(") this.fail(`Expected "(" after "\\${command}".`);
    this.index += 1;
  }

  private parseCategory(command: Command): BlocksCategory | undefined {
    if (this.peek() !== "[") return undefined;
    this.index += 1;
    const start = this.index;
    while (!this.atEnd() && /[A-Za-z]/.test(this.peek())) this.index += 1;
    const name = this.source.slice(start, this.index);
    if (this.peek() !== "]") this.fail(`Expected "]" after category for "\\${command}".`);
    this.index += 1;
    if (command === "value" || command === "variable") {
      this.fail(`Category annotation is not allowed on "\\${command}".`, start - 1);
    }
    if (!BLOCKS_CATEGORIES.includes(name as BlocksCategory)) {
      this.fail(`Unknown Blocks category "${name}".`, start);
    }
    return name as BlocksCategory;
  }

  private expect(character: string, message: string): void {
    if (this.peek() !== character) this.fail(message);
    this.index += 1;
  }

  private skipWhitespace(): void {
    while (!this.atEnd() && /\s/.test(this.peek())) this.index += 1;
  }

  private peek(): string {
    return this.source[this.index] ?? "";
  }

  private atEnd(): boolean {
    return this.index >= this.source.length;
  }

  private fail(message: string, offset = this.index): never {
    let line = 1;
    let lineStart = 0;
    for (let index = 0; index < offset; index += 1) {
      if (this.source[index] === "\n") {
        line += 1;
        lineStart = index + 1;
      }
    }
    throw new BlocksSourceParseFailure({ message, offset, line, column: offset - lineStart + 1 });
  }

  private isVertical(command: Command): command is VerticalCommand {
    return command === "start" || command === "statement" || command === "scope" || command === "end";
  }

  private isCommand(value: string): value is Command {
    return value === "start" || value === "statement" || value === "scope" || value === "end" || value === "value" || value === "variable" || value === "logic";
  }

  private isDelimiter(value: string): boolean {
    return value === "(" || value === ")" || value === "{" || value === "}";
  }
}

class BlocksSourceParseFailure extends Error {
  constructor(readonly error: BlocksSourceSyntaxError) { super(error.message); }
}

export function parseBlocksSource(source: string): BlocksSourceParseResult {
  return new BlocksSourceParser(source).parse();
}
