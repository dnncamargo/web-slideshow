import type {
  ColorValue,
  TextContent,
  TextRun,
  TextRunMarks,
} from "@powershow/document-schema";

export interface TextSelectionRange {
  start: number;
  end: number;
}

type BooleanMarkName = "bold" | "italic" | "underline" | "code";

export type TextSelectionBooleanMarkState = "off" | "on" | "mixed";

export type TextSelectionColorState =
  | { kind: "none" }
  | { kind: "uniform"; color: ColorValue }
  | { kind: "mixed" };

interface TextCharacter {
  text: string;
  marks?: TextRunMarks;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sanitizeMarks(
  marks: TextRunMarks | undefined,
): TextRunMarks | undefined {
  if (!marks) {
    return undefined;
  }

  const next: TextRunMarks = {};

  if (marks.bold === true) {
    next.bold = true;
  }

  if (marks.italic === true) {
    next.italic = true;
  }

  if (marks.underline === true) {
    next.underline = true;
  }

  if (marks.code === true) {
    next.code = true;
  }

  if (marks.color !== undefined) {
    next.color = marks.color;
  }

  return next.bold !== undefined ||
    next.italic !== undefined ||
    next.underline !== undefined ||
    next.code !== undefined ||
    next.color !== undefined
    ? next
    : undefined;
}

function areMarksEqual(
  left: TextRunMarks | undefined,
  right: TextRunMarks | undefined,
): boolean {
  const normalizedLeft = sanitizeMarks(left);
  const normalizedRight = sanitizeMarks(right);

  return (
    normalizedLeft?.bold === normalizedRight?.bold &&
    normalizedLeft?.italic === normalizedRight?.italic &&
    normalizedLeft?.underline === normalizedRight?.underline &&
    normalizedLeft?.code === normalizedRight?.code &&
    areColorValuesEqual(normalizedLeft?.color, normalizedRight?.color)
  );
}

function areColorValuesEqual(
  left: ColorValue | undefined,
  right: ColorValue | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (left === undefined || right === undefined) {
    return false;
  }

  return typeof left !== "string" &&
    typeof right !== "string" &&
    left.kind === "palette" &&
    right.kind === "palette" &&
    left.colorId === right.colorId;
}

function expandTextContent(content: TextContent): TextCharacter[] {
  if (typeof content === "string") {
    return content.split("").map((text) => ({ text }));
  }

  return content.runs.flatMap((run) => {
    const marks = sanitizeMarks(run.marks);

    return run.text.split("").map((text) => ({
      text,
      marks,
    }));
  });
}

function buildTextContent(characters: readonly TextCharacter[]): TextContent {
  if (characters.length === 0) {
    return "";
  }

  const runs: TextRun[] = [];

  let currentText = characters[0]?.text ?? "";
  let currentMarks = sanitizeMarks(characters[0]?.marks);

  for (let index = 1; index < characters.length; index += 1) {
    const character = characters[index];
    const nextMarks = sanitizeMarks(character?.marks);

    if (character && areMarksEqual(currentMarks, nextMarks)) {
      currentText += character.text;
      continue;
    }

    runs.push(
      currentMarks === undefined
        ? { text: currentText }
        : { text: currentText, marks: currentMarks },
    );

    currentText = character?.text ?? "";
    currentMarks = nextMarks;
  }

  runs.push(
    currentMarks === undefined
      ? { text: currentText }
      : { text: currentText, marks: currentMarks },
  );

  const hasFormatting = runs.some((run) => run.marks !== undefined);

  return hasFormatting
    ? { type: "rich-text", runs }
    : runs.map((run) => run.text).join("");
}

export function getTextContentPlainText(content: TextContent): string {
  return typeof content === "string"
    ? content
    : content.runs.map((run) => run.text).join("");
}

export function normalizeTextSelectionRange(
  selection: TextSelectionRange | null | undefined,
  textLength: number,
): TextSelectionRange | null {
  if (!selection) {
    return null;
  }

  const lower = clampNumber(
    Math.min(selection.start, selection.end),
    0,
    textLength,
  );
  const upper = clampNumber(
    Math.max(selection.start, selection.end),
    0,
    textLength,
  );

  return lower === upper ? null : { start: lower, end: upper };
}

export function normalizeTextContent(content: TextContent): TextContent {
  return buildTextContent(expandTextContent(content));
}

function updateTextContentRange(
  content: TextContent,
  selection: TextSelectionRange | null | undefined,
  transform: (character: TextCharacter, relativeIndex: number) => TextCharacter,
): TextContent {
  const normalizedSelection = normalizeTextSelectionRange(
    selection,
    getTextContentPlainText(content).length,
  );

  if (!normalizedSelection) {
    return content;
  }

  const characters = expandTextContent(content);

  const nextCharacters = characters.map((character, index) =>
    index >= normalizedSelection.start && index < normalizedSelection.end
      ? transform(character, index - normalizedSelection.start)
      : character,
  );

  return normalizeTextContent(buildTextContent(nextCharacters));
}

function updateBooleanMark(
  character: TextCharacter,
  mark: BooleanMarkName,
  enabled: boolean,
): TextCharacter {
  const marks = sanitizeMarks(character.marks) ?? {};

  if (enabled) {
    marks[mark] = true;
  } else {
    delete marks[mark];
  }

  return {
    ...character,
    marks: sanitizeMarks(marks),
  };
}

function updateColorMark(
  character: TextCharacter,
  color: ColorValue | undefined,
): TextCharacter {
  const marks = sanitizeMarks(character.marks) ?? {};

  if (color === undefined) {
    delete marks.color;
  } else {
    marks.color = color;
  }

  return {
    ...character,
    marks: sanitizeMarks(marks),
  };
}

export function getTextContentSelectionBooleanMarkState(
  content: TextContent,
  selection: TextSelectionRange | null | undefined,
  mark: BooleanMarkName,
): TextSelectionBooleanMarkState | null {
  const normalizedSelection = normalizeTextSelectionRange(
    selection,
    getTextContentPlainText(content).length,
  );

  if (!normalizedSelection) {
    return null;
  }

  const characters = expandTextContent(content);

  const selectedCharacters = characters.slice(
    normalizedSelection.start,
    normalizedSelection.end,
  );
  const markedCharacterCount = selectedCharacters.filter(
    (character) => character.marks?.[mark] === true,
  ).length;

  if (markedCharacterCount === 0) {
    return "off";
  }

  return markedCharacterCount === selectedCharacters.length ? "on" : "mixed";
}

export function getTextContentSelectionColorState(
  content: TextContent,
  selection: TextSelectionRange | null | undefined,
): TextSelectionColorState | null {
  const normalizedSelection = normalizeTextSelectionRange(
    selection,
    getTextContentPlainText(content).length,
  );

  if (!normalizedSelection) {
    return null;
  }

  const characters = expandTextContent(content).slice(
    normalizedSelection.start,
    normalizedSelection.end,
  );

  if (characters.length === 0) {
    return null;
  }

  const color = characters[0]?.marks?.color;

  return characters.every((character) =>
    areColorValuesEqual(character.marks?.color, color),
  )
    ? color === undefined
      ? { kind: "none" }
      : { kind: "uniform", color }
    : { kind: "mixed" };
}

export function toggleTextContentBooleanMark(
  content: TextContent,
  selection: TextSelectionRange | null | undefined,
  mark: BooleanMarkName,
): TextContent {
  const normalizedSelection = normalizeTextSelectionRange(
    selection,
    getTextContentPlainText(content).length,
  );

  if (!normalizedSelection) {
    return content;
  }

  const shouldEnable = getTextContentSelectionBooleanMarkState(
    content,
    normalizedSelection,
    mark,
  ) !== "on";

  return updateTextContentRange(content, normalizedSelection, (character) =>
    updateBooleanMark(character, mark, shouldEnable),
  );
}

export function applyTextContentColor(
  content: TextContent,
  selection: TextSelectionRange | null | undefined,
  color: ColorValue,
): TextContent {
  return updateTextContentRange(content, selection, (character) =>
    updateColorMark(character, color),
  );
}

export function clearTextContentColor(
  content: TextContent,
  selection: TextSelectionRange | null | undefined,
): TextContent {
  return updateTextContentRange(content, selection, (character) =>
    updateColorMark(character, undefined),
  );
}

export function clearTextContentFormatting(
  content: TextContent,
  selection: TextSelectionRange | null | undefined,
): TextContent {
  return updateTextContentRange(content, selection, (character) => ({
    ...character,
    marks: undefined,
  }));
}

export function reconcileTextContentEdit(
  content: TextContent,
  nextPlainText: string,
): TextContent {
  const currentPlainText = getTextContentPlainText(content);

  if (currentPlainText === nextPlainText) {
    return normalizeTextContent(content);
  }

  if (typeof content === "string") {
    return nextPlainText;
  }

  const characters = expandTextContent(content);
  const oldLength = currentPlainText.length;
  const nextLength = nextPlainText.length;

  let prefixLength = 0;

  while (
    prefixLength < oldLength &&
    prefixLength < nextLength &&
    currentPlainText.charCodeAt(prefixLength) ===
      nextPlainText.charCodeAt(prefixLength)
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;

  while (
    suffixLength < oldLength - prefixLength &&
    suffixLength < nextLength - prefixLength &&
    currentPlainText.charCodeAt(oldLength - 1 - suffixLength) ===
      nextPlainText.charCodeAt(nextLength - 1 - suffixLength)
  ) {
    suffixLength += 1;
  }

  const removedCharacters = characters.slice(
    prefixLength,
    oldLength - suffixLength,
  );

  let inheritedMarks: TextRunMarks | undefined;

  if (removedCharacters.length > 0) {
    // Replacement: inherit exactly from the first replaced character,
    // including the valid case where that character has no marks.
    inheritedMarks = sanitizeMarks(removedCharacters[0]?.marks);
  } else if (prefixLength > 0) {
    // Pure insertion: prefer the immediately preceding character.
    inheritedMarks = sanitizeMarks(characters[prefixLength - 1]?.marks);
  } else {
    // Pure insertion at the beginning: use the following character.
    inheritedMarks = sanitizeMarks(characters[0]?.marks);
  }

  const insertedText = nextPlainText.slice(
    prefixLength,
    nextLength - suffixLength,
  );

  const insertedCharacters = insertedText.split("").map((text) => ({
    text,
    marks: inheritedMarks,
  }));

  return normalizeTextContent(
    buildTextContent([
      ...characters.slice(0, prefixLength),
      ...insertedCharacters,
      ...characters.slice(oldLength - suffixLength),
    ]),
  );
}
