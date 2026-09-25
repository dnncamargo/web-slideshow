import type {
  TerminalElement,
  Presentation,
} from "@web-slideshow/document-schema";
import { resolveLinkedTerminalStyle } from "@web-slideshow/document-schema";

import {
  escapeHtml,
} from "./escape-html";

import { quoteCssString } from "./escape-css-string";

import { renderCanonicalDataStyle } from "./render-canonical-data";
import { renderColorValue } from "./render-palette";
import { renderLength } from "./render-length";
import { renderBorder, renderGradient } from "./render-visual";
import { renderRichText, renderTextContent } from "./render-rich-text";

function renderTerminalContent(
  content: TerminalElement["title"],
): string {
  if (content === undefined) {
    return "";
  }

  return typeof content === "string"
    ? renderTextContent(content, { newlineMode: "preserve" })
    : renderRichText(content, { newlineMode: "preserve" });
}

function hasTerminalTitleText(
  content: TerminalElement["title"],
): boolean {
  if (content === undefined) {
    return false;
  }

  return typeof content === "string"
    ? content.length > 0
    : content.runs.some((run) => run.text.length > 0);
}

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
  presentation?: Presentation,
): string {
  if (element.hidden) {
    return "";
  }

  if (element.linkedStyleId !== undefined && presentation === undefined) {
    throw new Error(`Cannot render linked terminal style without presentation context: ${element.linkedStyleId}`);
  }
  const resolved = element.linkedStyleId === undefined
    ? {}
    : resolveLinkedTerminalStyle(presentation!, element);
  const effectiveElement = { ...element, ...resolved };
  const classes = [
    "presentation-element",
    "presentation-terminal",
  ];

  const customClass =
    effectiveElement.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const rootStyles: string[] = [];

  const baseStyle = renderCanonicalDataStyle(effectiveElement);

  if (baseStyle) {
    rootStyles.push(baseStyle);
  }

  const semanticColors = [
    ["command", effectiveElement.style?.commandColor],
    ["prompt", effectiveElement.style?.promptColor],
    ["output", effectiveElement.style?.outputColor],
    ["comment", effectiveElement.style?.commentColor],
    ["error", effectiveElement.style?.errorColor],
  ] as const;

  for (const [name, color] of semanticColors) {
    if (color !== undefined) {
      rootStyles.push(`--presentation-terminal-${name}-color:${renderColorValue(color)}`);
    }
  }

  const styleAttribute = rootStyles.length > 0
    ? ` style="${escapeHtml(rootStyles.join(";"))}"`
    : "";

  const bodyStyles: string[] = [];
  const typography = effectiveElement.typography;

  if (typography?.fontFamily !== undefined) {
    bodyStyles.push(`font-family:${quoteCssString(typography.fontFamily)}`);
  }

  if (typography?.fontSize !== undefined) {
    bodyStyles.push(`font-size:${renderLength(typography.fontSize)}`);
  }

  if (typography?.lineHeight !== undefined) {
    bodyStyles.push(`line-height:${typography.lineHeight}`);
    bodyStyles.push(`--presentation-terminal-line-height:${typography.lineHeight}em`);
  }

  if (typography?.letterSpacing !== undefined) {
    bodyStyles.push(`letter-spacing:${renderLength(typography.letterSpacing)}`);
  }

  const bodyStyleAttribute = bodyStyles.length > 0
    ? ` style="${escapeHtml(bodyStyles.join(";"))}"`
    : "";

  const titleStyles = [
    ...renderTitleStyle(effectiveElement),
    ...renderTitleTypography(effectiveElement),
  ];
  const titleStyleAttribute = titleStyles.length > 0
    ? ` style="${escapeHtml(titleStyles.join(";"))}"`
    : "";
  const titleClasses = ["presentation-terminal-title"];
  const customTitleClass = element.titleStyle?.className?.trim();

  if (customTitleClass) {
    titleClasses.push(customTitleClass);
  }

  const titleBar = hasTerminalTitleText(element.title)
    ? (
      `<div class="presentation-terminal-titlebar">` +
        `<div` +
          ` class="presentation-terminal-controls"` +
          ` aria-hidden="true"` +
        `>` +
          `<span` +
            ` class="presentation-terminal-control presentation-terminal-control-close"` +
          `></span>` +
          `<span` +
            ` class="presentation-terminal-control presentation-terminal-control-minimize"` +
          `></span>` +
          `<span` +
            ` class="presentation-terminal-control presentation-terminal-control-expand"` +
          `></span>` +
        `</div>` +
        `<div class="${escapeHtml(titleClasses.join(" "))}"${titleStyleAttribute}>` +
        renderTerminalContent(element.title) +
        `</div>` +
      `</div>`
    )
    : "";

  const lines = element.lines
    .map((line) => {
      return (
        `<div` +
          ` class="presentation-terminal-line presentation-terminal-line-${line.type}"` +
          ` data-terminal-line-type="${line.type}"` +
        `>` +
          (typeof line.content === "string"
            ? renderTextContent(line.content, { newlineMode: "preserve" })
            : renderRichText(line.content, { newlineMode: "preserve" })) +
        `</div>`
      );
    })
    .join("");

  return (
    `<div` +
      ` class="${escapeHtml(
        classes.join(" "),
      )}"` +
      ` data-presentation-id="${escapeHtml(
        element.id,
      )}"` +
      ` data-presentation-type="terminal"` +
      styleAttribute +
    `>` +
      titleBar +
      `<div class="presentation-terminal-body"${bodyStyleAttribute}>` +
        lines +
      `</div>` +
    `</div>`
  );
}
