import type {
  TerminalElement,
} from "@powershow/document-schema";

import {
  escapeHtml,
} from "./escape-html";

import { renderCanonicalDataElementStyle } from "./render-canonical-data";

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

  const baseStyle = renderCanonicalDataElementStyle(element);

  const styleAttribute = baseStyle
    ? ` style="${escapeHtml(baseStyle)}"`
    : "";

  const titleBar = element.title
    ? (
      `<div class="powershow-terminal-titlebar">` +
        `<div` +
          ` class="powershow-terminal-controls"` +
          ` aria-hidden="true"` +
        `>` +
          `<span` +
            ` class="powershow-terminal-control powershow-terminal-control-close"` +
          `></span>` +
          `<span` +
            ` class="powershow-terminal-control powershow-terminal-control-minimize"` +
          `></span>` +
          `<span` +
            ` class="powershow-terminal-control powershow-terminal-control-expand"` +
          `></span>` +
        `</div>` +
        `<div class="powershow-terminal-title">` +
          escapeHtml(element.title) +
        `</div>` +
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
      titleBar +
      `<div class="powershow-terminal-body">` +
        lines +
      `</div>` +
    `</div>`
  );
}
