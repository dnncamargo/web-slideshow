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
import { renderBorder, renderGradient } from "./render-visual";

function renderTitleStyle(element: TerminalElement): string[] {
  const output: string[] = [];
  const style = element.titleStyle;

  if (style?.color !== undefined) {
    output.push(`color:${renderColorValue(style.color)}`);
  }

  if (style?.background?.color !== undefined) {
    output.push(`background:${renderColorValue(style.background.color)}`);
  }

  if (style?.background?.gradient !== undefined) {
    output.push(`background-image:${renderGradient(style.background.gradient)}`);
  }

  if (style?.border !== undefined) {
    output.push(...renderBorder(style.border));
  }

  if (style?.borderRadius !== undefined) {
    output.push(`border-radius:${renderLength(style.borderRadius)}`);
  }

  return output;
}

function renderTitleTypography(element: TerminalElement): string[] {
  const output: string[] = [];
  const typography = element.titleTypography;

  if (typography?.fontFamily !== undefined) {
    output.push(`font-family:${quoteCssString(typography.fontFamily)}`);
  }

  if (typography?.fontSize !== undefined) {
    output.push(`font-size:${renderLength(typography.fontSize)}`);
  }

  if (typography?.fontWeight !== undefined) {
    output.push(`font-weight:${typography.fontWeight}`);
  }

  if (typography?.fontStyle !== undefined) {
    output.push(`font-style:${typography.fontStyle}`);
  }

  if (typography?.lineHeight !== undefined) {
    output.push(`line-height:${typography.lineHeight}`);
  }

  if (typography?.letterSpacing !== undefined) {
    output.push(`letter-spacing:${renderLength(typography.letterSpacing)}`);
  }

  if (typography?.textTransform !== undefined) {
    output.push(`text-transform:${typography.textTransform}`);
  }

  return output;
}

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

  const titleStyles = [
    ...renderTitleStyle(element),
    ...renderTitleTypography(element),
  ];
  const titleStyleAttribute = titleStyles.length > 0
    ? ` style="${escapeHtml(titleStyles.join(";"))}"`
    : "";
  const titleClasses = ["powershow-terminal-title"];
  const customTitleClass = element.titleStyle?.className?.trim();

  if (customTitleClass) {
    titleClasses.push(customTitleClass);
  }

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
        `<div class="${escapeHtml(titleClasses.join(" "))}"${titleStyleAttribute}>` +
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
