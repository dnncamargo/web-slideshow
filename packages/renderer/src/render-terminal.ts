import type {
  TerminalElement,
} from "@powershow/document-schema";

import {
  escapeHtml,
} from "./escape-html";

import { quoteCssString } from "./escape-css-string";

import { renderCanonicalDataStyle } from "./render-canonical-data";
import { renderColorValue } from "./render-palette";
import { renderLength } from "./render-length";

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

  const rootStyles: string[] = [];

  const baseStyle = renderCanonicalDataStyle(element);

  if (baseStyle) {
    rootStyles.push(baseStyle);
  }

  const semanticColors = [
    ["command", element.style?.commandColor],
    ["prompt", element.style?.promptColor],
    ["output", element.style?.outputColor],
    ["comment", element.style?.commentColor],
    ["error", element.style?.errorColor],
  ] as const;

  for (const [name, color] of semanticColors) {
    if (color !== undefined) {
      rootStyles.push(`--powershow-terminal-${name}-color:${renderColorValue(color)}`);
    }
  }

  const styleAttribute = rootStyles.length > 0
    ? ` style="${escapeHtml(rootStyles.join(";"))}"`
    : "";

  const bodyStyles: string[] = [];
  const typography = element.typography;

  if (typography?.fontFamily !== undefined) {
    bodyStyles.push(`font-family:${quoteCssString(typography.fontFamily)}`);
  }

  if (typography?.fontSize !== undefined) {
    bodyStyles.push(`font-size:${renderLength(typography.fontSize)}`);
  }

  if (typography?.lineHeight !== undefined) {
    bodyStyles.push(`line-height:${typography.lineHeight}`);
    bodyStyles.push(`--powershow-terminal-line-height:${typography.lineHeight}em`);
  }

  if (typography?.letterSpacing !== undefined) {
    bodyStyles.push(`letter-spacing:${renderLength(typography.letterSpacing)}`);
  }

  const bodyStyleAttribute = bodyStyles.length > 0
    ? ` style="${escapeHtml(bodyStyles.join(";"))}"`
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
      `<div class="powershow-terminal-body"${bodyStyleAttribute}>` +
        lines +
      `</div>` +
    `</div>`
  );
}
