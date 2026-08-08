import type {
  TerminalElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

export function renderTerminal(
  element: TerminalElement,
): string {
  if (element.hidden) {
    return "";
  }

  const classes = [
    "powershow-element",
    "powershow-terminal",
  ];

  const customClass =
    element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const baseStyle =
    renderStyle(element.style);

  const styleAttribute = baseStyle
    ? ` style="${escapeHtml(baseStyle)}"`
    : "";

  const title = element.title
    ? (
      `<div class="powershow-terminal-title">` +
      escapeHtml(element.title) +
      `</div>`
    )
    : "";

  const lines = element.lines
    .map((line) => {
      return (
        `<div` +
        ` class="powershow-terminal-line powershow-terminal-line-${line.type}"` +
        ` data-terminal-line-type="${line.type}"` +
        `>` +
        escapeHtml(line.content) +
        `</div>`
      );
    })
    .join("");

  return (
    `<div` +
    ` class="${escapeHtml(
      classes.join(" "),
    )}"` +
    ` data-powershow-id="${escapeHtml(
      element.id,
    )}"` +
    ` data-powershow-type="terminal"` +
    styleAttribute +
    `>` +
    title +
    `<div class="powershow-terminal-body">` +
    lines +
    `</div>` +
    `</div>`
  );
}