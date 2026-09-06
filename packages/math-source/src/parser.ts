import { tokenizeMathSource, type MathToken, type MathTokenizeResult } from "./tokenizer";

export interface MathNumberExpression {
  kind: "number";
  raw: string;
  start: number;
  end: number;
}

export interface MathIdentifierExpression {
  kind: "identifier";
  name: string;
  start: number;
  end: number;
}

export interface MathGroupExpression {
  kind: "group";
  expression: MathExpression;
  start: number;
  end: number;
}

export interface MathUnaryExpression {
  kind: "unary";
  operator: "+" | "-";
  operand: MathExpression;
  start: number;
  end: number;
}

export interface MathBinaryExpression {
  kind: "binary";
  operator: "+" | "-" | "*" | "/" | "^";
  left: MathExpression;
  right: MathExpression;
  start: number;
  end: number;
}

export interface MathCallExpression {
  kind: "call";
  callee: string;
  argument: MathExpression;
  start: number;
  end: number;
}

export type MathExpression =
  | MathNumberExpression
  | MathIdentifierExpression
  | MathGroupExpression
  | MathUnaryExpression
  | MathBinaryExpression
  | MathCallExpression;

export interface MathEquationStatement {
  kind: "equation";
  left: MathExpression;
  right: MathExpression;
  start: number;
  end: number;
}

export interface MathProgram {
  kind: "program";
  statements: MathEquationStatement[];
  start: number;
  end: number;
}

export type MathParseDiagnosticCode =
  | "unexpected-token"
  | "expected-token"
  | "nesting-limit-exceeded";

export interface MathParseDiagnostic {
  code: MathParseDiagnosticCode;
  message: string;
  start: number;
  end: number;
}

export type MathSourceDiagnostic = MathTokenizeResult["diagnostics"][number] | MathParseDiagnostic;

export interface MathParseResult {
  program: MathProgram;
  diagnostics: MathSourceDiagnostic[];
}

const MAX_NESTING_DEPTH = 128;

class LineParser {
  private index = 0;
  private depth = 0;
  private failed = false;
  private nestingReported = false;

  public constructor(
    private readonly tokens: MathToken[],
    private readonly diagnostics: MathParseDiagnostic[],
  ) {}

  public parseLine(): MathEquationStatement | null {
    const left = this.parseExpression();
    if (left === null || this.failed) return null;
    if (!this.consume("equals")) {
      this.error("expected-token", "Expected '='.");
      return null;
    }
    const right = this.parseExpression();
    if (right === null || this.failed) return null;
    if (!this.at("newline") && !this.at("eof")) {
      this.error("unexpected-token", "Unexpected token.");
      return null;
    }
    return { kind: "equation", left, right, start: left.start, end: right.end };
  }

  public recover(): void {
    while (!this.at("newline") && !this.at("eof")) this.index += 1;
  }

  public at(kind: MathToken["kind"]): boolean {
    return this.current().kind === kind;
  }

  public advance(): MathToken {
    const token = this.current();
    this.index += 1;
    return token;
  }

  private parseExpression(): MathExpression | null {
    return this.parseAdditive();
  }

  private parseAdditive(): MathExpression | null {
    let expression = this.parseMultiplicative();
    while (expression !== null && (this.at("plus") || this.at("minus"))) {
      const operator = this.advance();
      const right = this.parseMultiplicative();
      if (right === null) return null;
      expression = this.binary(operator, expression, right);
    }
    return expression;
  }

  private parseMultiplicative(): MathExpression | null {
    let expression = this.parseUnary();
    while (expression !== null && (this.at("star") || this.at("slash"))) {
      const operator = this.advance();
      const right = this.parseUnary();
      if (right === null) return null;
      expression = this.binary(operator, expression, right);
    }
    return expression;
  }

  private parseUnary(): MathExpression | null {
    if (this.at("plus") || this.at("minus")) {
      if (!this.enter()) return null;
      const operator = this.advance();
      const operand = this.parseUnary();
      this.leave();
      if (operand === null) return null;
      return {
        kind: "unary",
        operator: operator.kind === "plus" ? "+" : "-",
        operand,
        start: operator.start,
        end: operand.end,
      };
    }
    return this.parsePower();
  }

  private parsePower(): MathExpression | null {
    const left = this.parsePrimary();
    if (left === null || !this.at("caret")) return left;
    if (!this.enter()) return null;
    this.advance();
    const right = this.parseUnary();
    this.leave();
    if (right === null) return null;
    return this.binaryFromParts("^", left, right);
  }

  private parsePrimary(): MathExpression | null {
    const token = this.current();
    if (token.kind === "number") {
      this.advance();
      return { kind: "number", raw: token.lexeme, start: token.start, end: token.end };
    }
    if (token.kind === "identifier") {
      this.advance();
      if (!this.at("left-paren")) {
        return { kind: "identifier", name: token.lexeme, start: token.start, end: token.end };
      }
      if (!this.enter()) return null;
      this.advance();
      const argument = this.parseExpression();
      if (argument === null) {
        this.leave();
        return null;
      }
      const close = this.expect("right-paren", "Expected ')'.");
      this.leave();
      if (close === null) return null;
      return { kind: "call", callee: token.lexeme, argument, start: token.start, end: close.end };
    }
    if (token.kind === "left-paren") {
      if (!this.enter()) return null;
      const open = this.advance();
      const expression = this.parseExpression();
      if (expression === null) {
        this.leave();
        return null;
      }
      const close = this.expect("right-paren", "Expected ')'.");
      this.leave();
      if (close === null) return null;
      return { kind: "group", expression, start: open.start, end: close.end };
    }
    this.error("expected-token", "Expected expression.");
    return null;
  }

  private current(): MathToken {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!;
  }

  private consume(kind: MathToken["kind"]): MathToken | null {
    return this.at(kind) ? this.advance() : null;
  }

  private expect(kind: MathToken["kind"], message: string): MathToken | null {
    const token = this.consume(kind);
    if (token === null) this.error("expected-token", message);
    return token;
  }

  private error(code: MathParseDiagnosticCode, message: string): void {
    if (this.failed) return;
    const token = this.current();
    this.diagnostics.push({ code, message, start: token.start, end: token.end });
    this.failed = true;
  }

  private enter(): boolean {
    if (this.depth >= MAX_NESTING_DEPTH) {
      if (!this.nestingReported) {
        this.error("nesting-limit-exceeded", "Nesting limit exceeded.");
        this.nestingReported = true;
      }
      return false;
    }
    this.depth += 1;
    return true;
  }

  private leave(): void {
    this.depth -= 1;
  }

  private binary(token: MathToken, left: MathExpression, right: MathExpression): MathBinaryExpression {
    const operator: MathBinaryExpression["operator"] =
      token.kind === "plus" ? "+" : token.kind === "minus" ? "-" : token.kind === "star" ? "*" : "/";
    return this.binaryFromParts(operator, left, right);
  }

  private binaryFromParts(
    operator: MathBinaryExpression["operator"],
    left: MathExpression,
    right: MathExpression,
  ): MathBinaryExpression {
    return { kind: "binary", operator, left, right, start: left.start, end: right.end };
  }
}

export function parseMathSource(source: string): MathParseResult {
  const tokenized = tokenizeMathSource(source);
  const parserDiagnostics: MathParseDiagnostic[] = [];
  const statements: MathEquationStatement[] = [];
  let index = 0;

  while (index < tokenized.tokens.length) {
    while (tokenized.tokens[index]?.kind === "newline") index += 1;
    const token = tokenized.tokens[index];
    if (token === undefined || token.kind === "eof") break;
    const lineTokens: MathToken[] = [];
    while (tokenized.tokens[index] !== undefined && tokenized.tokens[index]!.kind !== "newline" && tokenized.tokens[index]!.kind !== "eof") {
      lineTokens.push(tokenized.tokens[index]!);
      index += 1;
    }
    const boundary = tokenized.tokens[index];
    lineTokens.push(boundary ?? { kind: "eof", lexeme: "", start: source.length, end: source.length });
    const lineParser = new LineParser(lineTokens, parserDiagnostics);
    const statement = lineParser.parseLine();
    if (statement !== null) statements.push(statement);
    if (boundary?.kind === "newline") index += 1;
  }

  const diagnostics: MathSourceDiagnostic[] = [...tokenized.diagnostics, ...parserDiagnostics];
  diagnostics.sort((a, b) => a.start - b.start || a.end - b.end);
  return { program: { kind: "program", statements, start: 0, end: source.length }, diagnostics };
}
