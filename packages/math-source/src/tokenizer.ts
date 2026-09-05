export type MathTokenKind =
  | "number"
  | "identifier"
  | "plus"
  | "minus"
  | "star"
  | "slash"
  | "caret"
  | "left-paren"
  | "right-paren"
  | "equals"
  | "newline"
  | "eof";

export interface MathToken {
  kind: MathTokenKind;
  lexeme: string;
  start: number;
  end: number;
}

export interface MathDiagnostic {
  code: "unexpected-character" | "invalid-number" | "token-limit-exceeded";
  message: string;
  start: number;
  end: number;
}

export interface MathTokenizeResult {
  tokens: MathToken[];
  diagnostics: MathDiagnostic[];
}

const MAX_TOKENS = 1024;
const MAX_ORDINARY_TOKENS = MAX_TOKENS - 1;

const punctuation: Readonly<Record<string, MathTokenKind>> = {
  "+": "plus",
  "-": "minus",
  "*": "star",
  "/": "slash",
  "^": "caret",
  "(": "left-paren",
  ")": "right-paren",
  "=": "equals",
};

function isAsciiDigit(character: string | undefined): boolean {
  return character !== undefined && character >= "0" && character <= "9";
}

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z]/.test(character);
}

function isIdentifierPart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function diagnostic(
  code: MathDiagnostic["code"],
  message: string,
  start: number,
  end: number,
): MathDiagnostic {
  return { code, message, start, end };
}

export function tokenizeMathSource(source: string): MathTokenizeResult {
  const tokens: MathToken[] = [];
  const diagnostics: MathDiagnostic[] = [];
  let position = 0;
  let limitReported = false;

  const addToken = (kind: MathTokenKind, start: number, end: number): boolean => {
    if (tokens.length >= MAX_ORDINARY_TOKENS) {
      if (!limitReported) {
        diagnostics.push(
          diagnostic(
            "token-limit-exceeded",
            "Token limit exceeded.",
            start,
            end,
          ),
        );
        limitReported = true;
      }
      position = start;
      return false;
    }
    tokens.push({ kind, lexeme: source.slice(start, end), start, end });
    return true;
  };

  while (position < source.length) {
    const start = position;
    const character = source[position];

    if (character === " " || character === "\t") {
      position += 1;
      continue;
    }

    if (character === "\r" || character === "\n") {
      position += character === "\r" && source[position + 1] === "\n" ? 2 : 1;
      if (!addToken("newline", start, position)) break;
      continue;
    }

    if (isAsciiDigit(character)) {
      while (isAsciiDigit(source[position])) position += 1;
      if (source[position] === ".") {
        if (isAsciiDigit(source[position + 1])) {
          position += 1;
          while (isAsciiDigit(source[position])) position += 1;
          if (!addToken("number", start, position)) break;
        } else {
          position += 1;
          diagnostics.push(
            diagnostic("invalid-number", "Invalid number.", start, position),
          );
        }
      } else if (!addToken("number", start, position)) {
        break;
      }
      continue;
    }

    if (character === ".") {
      if (isAsciiDigit(source[position + 1])) {
        position += 1;
        while (isAsciiDigit(source[position])) position += 1;
        diagnostics.push(
          diagnostic("invalid-number", "Invalid number.", start, position),
        );
      } else {
        position += 1;
        diagnostics.push(
          diagnostic("unexpected-character", "Unexpected character.", start, position),
        );
      }
      continue;
    }

    if (isIdentifierStart(character)) {
      position += 1;
      while (isIdentifierPart(source[position])) position += 1;
      if (!addToken("identifier", start, position)) break;
      continue;
    }

    const kind = character === undefined ? undefined : punctuation[character];
    if (kind !== undefined) {
      position += 1;
      if (!addToken(kind, start, position)) break;
      continue;
    }

    const codePoint = source.codePointAt(position);
    position += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    diagnostics.push(
      diagnostic("unexpected-character", "Unexpected character.", start, position),
    );
  }

  tokens.push({ kind: "eof", lexeme: "", start: position, end: position });
  return { tokens, diagnostics };
}
