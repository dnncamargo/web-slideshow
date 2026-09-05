import type {
  RichTextContent,
  TextContent,
  TextRun,
  TextRunMarks,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderColorValue } from "./render-palette";

export type RichTextRenderOptions = Readonly<{
  newlineMode?: "br" | "preserve";
}>;

function renderNewlines(text: string, newlineMode: "br" | "preserve"): string {
  return newlineMode === "br"
    ? text.replace(/\r\n|\r|\n/g, "<br>")
    : text;
}

export function renderTextContent(
  text: string,
  options: RichTextRenderOptions = {},
): string {
  return renderNewlines(
    escapeHtml(text),
    options.newlineMode ?? "br",
  );
}

function renderSpanStyle(marks: TextRunMarks): string | undefined {
  const styles: string[] = [];

  if (marks.underline === true) {
    styles.push("text-decoration-line:underline");
  }

  if (marks.color !== undefined) {
    styles.push(`color:${renderColorValue(marks.color)}`);
  }

  return styles.length > 0 ? styles.join(";") : undefined;
}

function wrapMarks(content: string, marks: TextRunMarks | undefined): string {
  let output = content;

  if (marks?.code === true) {
    output = `<code>${output}</code>`;
  }

  if (marks?.bold === true) {
    output = `<strong>${output}</strong>`;
  }

  if (marks?.italic === true) {
    output = `<em>${output}</em>`;
  }

  const spanStyle = marks ? renderSpanStyle(marks) : undefined;

  if (spanStyle) {
    output = `<span style="${escapeHtml(spanStyle)}">${output}</span>`;
  }

  return output;
}

function renderRun(
  run: TextRun,
  options: RichTextRenderOptions,
): string {
  const content = renderTextContent(run.text, options);

  return wrapMarks(content, run.marks);
}

export function renderRichText(
  content: RichTextContent,
  options: RichTextRenderOptions = {},
): string {
  return content.runs.map((run) => renderRun(run, options)).join("");
}

function lineContent(runs: TextRun[]): TextContent {
  if (runs.length === 0) {
    return "";
  }

  return runs.some((run) => run.marks !== undefined)
    ? { type: "rich-text", runs }
    : runs.map((run) => run.text).join("");
}

export function splitTextContentLines(content: TextContent): TextContent[] {
  if (typeof content === "string") {
    return content.split("\n");
  }

  const lines: TextRun[][] = [[]];

  for (const run of content.runs) {
    const parts = run.text.split("\n");

    parts.forEach((part, index) => {
      if (part.length > 0 || run.marks !== undefined) {
        lines[lines.length - 1]?.push({
          text: part,
          ...(run.marks === undefined ? {} : { marks: run.marks }),
        });
      }

      if (index < parts.length - 1) {
        lines.push([]);
      }
    });
  }

  return lines.map(lineContent);
}
