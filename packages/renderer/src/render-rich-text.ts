import type {
  RichTextContent,
  TextRun,
  TextRunMarks,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";

function renderSpanStyle(marks: TextRunMarks): string | undefined {
  const styles: string[] = [];

  if (marks.underline === true) {
    styles.push("text-decoration-line:underline");
  }

  if (marks.color !== undefined) {
    styles.push(`color:${marks.color}`);
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

function renderRun(run: TextRun): string {
  const content = escapeHtml(run.text);

  return wrapMarks(content, run.marks);
}

export function renderRichText(content: RichTextContent): string {
  return content.runs.map(renderRun).join("");
}
