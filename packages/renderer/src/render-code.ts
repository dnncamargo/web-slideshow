import type {
  CodeElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

export function renderCode(
  element: CodeElement,
): string {
  if (element.hidden) {
    return "";
  }

  const styles: string[] = [];

  const baseStyle = renderStyle(
    element.style,
  );

  if (baseStyle) {
    styles.push(baseStyle);
  }

  const customClass =
    element.style?.className?.trim();

  const classes = [
    "powershow-element",
    "powershow-code",
  ];

  if (customClass) {
    classes.push(customClass);
  }

  const lines = element.code.split("\n");

  const content = lines
    .map((line, index) => {
      const lineNumber = index + 1;

      const highlighted =
        element.highlightedLines.includes(
          lineNumber,
        );

      const lineClasses = [
        "powershow-code-line",
      ];

      if (highlighted) {
        lineClasses.push(
          "powershow-code-line-highlighted",
        );
      }

      const number = element.showLineNumbers
        ? (
          `<span` +
          ` class="powershow-code-line-number"` +
          ` aria-hidden="true"` +
          `>${lineNumber}</span>`
        )
        : "";

      return (
        `<span` +
        ` class="${lineClasses.join(" ")}"` +
        ` data-line="${lineNumber}"` +
        `>` +
        number +
        `<span class="powershow-code-line-content">` +
        escapeHtml(line || " ") +
        `</span>` +
        `</span>`
      );
    })
    .join("\n");

  const styleAttribute =
    styles.length > 0
      ? ` style="${escapeHtml(
          styles.join(";"),
        )}"`
      : "";

  return (
    `<pre` +
    ` class="${escapeHtml(
      classes.join(" "),
    )}"` +
    ` data-powershow-id="${escapeHtml(
      element.id,
    )}"` +
    ` data-powershow-type="code"` +
    ` data-language="${escapeHtml(
      element.language,
    )}"` +
    styleAttribute +
    `>` +
    `<code>` +
    content +
    `</code>` +
    `</pre>`
  );
}