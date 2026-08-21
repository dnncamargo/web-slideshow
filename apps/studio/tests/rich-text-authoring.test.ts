import { describe, expect, it } from "vitest";

import type { TextContent, TextRun } from "@powershow/document-schema";

import {
  applyTextContentColor,
  clearTextContentColor,
  getTextContentPlainText,
  normalizeTextContent,
  reconcileTextContentEdit,
  toggleTextContentBooleanMark,
} from "../src/features/editor/rich-text-authoring";

function richText(runs: TextRun[]): TextContent {
  return {
    type: "rich-text",
    runs,
  };
}

describe("rich-text authoring utilities", () => {
  it("gets plain text from a string", () => {
    expect(getTextContentPlainText("Hello")).toBe("Hello");
  });

  it("gets plain text from rich runs", () => {
    expect(
      getTextContentPlainText(
        richText([
          { text: "Dar " },
          { text: "instruções", marks: { bold: true } },
          { text: " para um computador" },
        ]),
      ),
    ).toBe("Dar instruções para um computador");
  });

  it("applies bold to a substring of a string", () => {
    expect(
      toggleTextContentBooleanMark(
        "Dar instruções para um computador",
        { start: 4, end: 14 },
        "bold",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "Dar " },
        { text: "instruções", marks: { bold: true } },
        { text: " para um computador" },
      ],
    });
  });

  it("toggles the same bold selection off back to a string", () => {
    const bolded = toggleTextContentBooleanMark(
      "Dar instruções para um computador",
      { start: 4, end: 14 },
      "bold",
    );

    expect(
      toggleTextContentBooleanMark(bolded, { start: 4, end: 14 }, "bold"),
    ).toBe("Dar instruções para um computador");
  });

  it("allows italic to overlap an existing bold range without removing bold", () => {
    expect(
      toggleTextContentBooleanMark(
        richText([
          { text: "a" },
          { text: "bc", marks: { bold: true } },
          { text: "d" },
        ]),
        { start: 1, end: 3 },
        "italic",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "a" },
        { text: "bc", marks: { bold: true, italic: true } },
        { text: "d" },
      ],
    });
  });

  it("allows underline to overlap other marks", () => {
    expect(
      toggleTextContentBooleanMark(
        richText([{ text: "abc", marks: { bold: true } }]),
        { start: 1, end: 3 },
        "underline",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "a", marks: { bold: true } },
        { text: "bc", marks: { bold: true, underline: true } },
      ],
    });
  });

  it("allows code to overlap other marks", () => {
    expect(
      toggleTextContentBooleanMark(
        richText([{ text: "abc", marks: { italic: true } }]),
        { start: 0, end: 2 },
        "code",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "ab", marks: { italic: true, code: true } },
        { text: "c", marks: { italic: true } },
      ],
    });
  });

  it("applies color only to the selected range", () => {
    expect(
      applyTextContentColor(
        richText([{ text: "abc" }]),
        { start: 1, end: 2 },
        "#7c3aed",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "a" },
        { text: "b", marks: { color: "#7c3aed" } },
        { text: "c" },
      ],
    });
  });

  it("clears color while preserving other marks", () => {
    expect(
      clearTextContentColor(
        richText([
          { text: "a", marks: { bold: true } },
          { text: "b", marks: { bold: true, color: "#7c3aed" } },
          { text: "c", marks: { bold: true, color: "#7c3aed" } },
        ]),
        { start: 1, end: 3 },
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "abc", marks: { bold: true } },
      ],
    });
  });

  it("merges adjacent runs with equal effective marks", () => {
    expect(
      normalizeTextContent(
        richText([
          { text: "a", marks: { bold: true } },
          { text: "b", marks: { bold: true, italic: false } },
          { text: "c" },
        ]),
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "ab", marks: { bold: true } },
        { text: "c" },
      ],
    });
  });

  it("normalizes unmarked rich text back to a string", () => {
    expect(
      normalizeTextContent(
        richText([
          { text: "Hello" },
          { text: " " },
          { text: "world" },
        ]),
      ),
    ).toBe("Hello world");
  });

  it("normalizes empty content to an empty string", () => {
    expect(normalizeTextContent(richText([]))).toBe("");
  });

  it("treats an empty selection as a no-op", () => {
    const content = richText([{ text: "abc", marks: { bold: true } }]);

    expect(
      toggleTextContentBooleanMark(content, { start: 1, end: 1 }, "italic"),
    ).toBe(content);
  });

  it("clamps an out-of-range selection deterministically", () => {
    expect(
      toggleTextContentBooleanMark("abc", { start: -10, end: 99 }, "bold"),
    ).toEqual({
      type: "rich-text",
      runs: [{ text: "abc", marks: { bold: true } }],
    });
  });

  it("drops false boolean marks during normalization", () => {
    expect(
      normalizeTextContent(
        richText([
          {
            text: "abc",
            marks: {
              bold: false,
              italic: false,
              underline: false,
              code: false,
            },
          },
        ]),
      ),
    ).toBe("abc");
  });

  it("typing before a marked range preserves the marked range", () => {
    expect(
      reconcileTextContentEdit(
        richText([
          { text: "a" },
          { text: "bc", marks: { bold: true } },
        ]),
        "zabc",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "za" },
        { text: "bc", marks: { bold: true } },
      ],
    });
  });

  it("typing inside a marked run inherits that run's marks", () => {
    expect(
      reconcileTextContentEdit(
        richText([{ text: "abc", marks: { bold: true } }]),
        "abxcd",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [{ text: "abxcd", marks: { bold: true } }],
    });
  });

  it("typing after a marked run inherits the preceding character's marks", () => {
    expect(
      reconcileTextContentEdit(
        richText([{ text: "abc", marks: { bold: true } }]),
        "abc!",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [{ text: "abc!", marks: { bold: true } }],
    });
  });

  it("replacing selected marked text inherits the first replaced character's marks", () => {
    expect(
      reconcileTextContentEdit(
        richText([
          { text: "a" },
          { text: "bc", marks: { bold: true } },
          { text: "d" },
        ]),
        "aXd",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "a" },
        { text: "X", marks: { bold: true } },
        { text: "d" },
      ],
    });
  });

  it("deleting text across multiple runs preserves the remaining marks", () => {
    expect(
      reconcileTextContentEdit(
        richText([
          { text: "a", marks: { bold: true } },
          { text: "b", marks: { bold: true } },
          { text: "c", marks: { italic: true } },
          { text: "d", marks: { italic: true } },
        ]),
        "ad",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "a", marks: { bold: true } },
        { text: "d", marks: { italic: true } },
      ],
    });
  });

  it("deleting all marked text normalizes to a string", () => {
    expect(
      reconcileTextContentEdit(
        richText([{ text: "abc", marks: { bold: true } }]),
        "",
      ),
    ).toBe("");
  });

  it("treats a multi-character insertion as one contiguous edit", () => {
    expect(
      reconcileTextContentEdit(
        richText([
          { text: "ab", marks: { bold: true } },
          { text: "c" },
        ]),
        "abXYZc",
      ),
    ).toEqual({
      type: "rich-text",
      runs: [
        { text: "abXYZ", marks: { bold: true } },
        { text: "c" },
      ],
    });
  });

  it("keeps ordinary plain-string editing as a plain string", () => {
    expect(reconcileTextContentEdit("abc", "aXbc")).toBe("aXbc");
  });
});
