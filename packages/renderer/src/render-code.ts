import type {
  CodeElement,
} from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { quoteCssString } from "./escape-css-string";
import { renderCanonicalDataStyle } from "./render-canonical-data";
import { renderColorValue } from "./render-palette";
import { renderLength } from "./render-length";
import { renderGradientBorder } from "./render-visual";
import {
  renderRichText,
  renderTextContent,
  splitTextContentLines,
} from "./render-rich-text";

export function renderCode(
  element: CodeElement,
): string {
  if (element.hidden) {
    return "";
  }

  const styles: string[] = [];
  const gradientBorder = element.style?.border?.gradient;

  const baseStyle = renderCanonicalDataStyle(element, {
    includeBorder: gradientBorder === undefined,
  });

  if (baseStyle) {
    styles.push(baseStyle);
  }

  if (gradientBorder) {
    styles.push(
      "border:0",
      ...renderGradientBorder(gradientBorder, element.style?.border?.width ?? 0),
    );
    if (element.layout?.position === undefined) {
      styles.push("position:relative");
    }
    if (element.style?.borderRadius !== undefined) {
      styles.push(`--presentation-code-outer-radius:${renderLength(element.style.borderRadius)}`);
    }
  }

  const typography = element.typography;

  if (typography?.fontFamily !== undefined) {
    styles.push(`font-family:${quoteCssString(typography.fontFamily)}`);
  }

  if (typography?.fontSize !== undefined) {
    styles.push(`font-size:${renderLength(typography.fontSize)}`);
  }

  if (typography?.lineHeight !== undefined) {
    styles.push(`line-height:${typography.lineHeight}`);
  }

  if (typography?.letterSpacing !== undefined) {
    styles.push(`letter-spacing:${renderLength(typography.letterSpacing)}`);
  }

  if (element.style?.color !== undefined) {
    styles.push(`color:${renderColorValue(element.style.color)}`);
  }

  const customClass =
    element.style?.className?.trim();

  const classes = [
    "presentation-element",
    "presentation-code",
  ];

  if (customClass) {
    classes.push(customClass);
  }

  if (gradientBorder) {
    classes.push("presentation-code-gradient-frame", "presentation-gradient-border");
  }

  const lines = splitTextContentLines(element.code);

  const content = lines
    .map((line, index) => {
      const lineNumber = index + 1;

      const highlighted =
        element.highlightedLines.includes(
          lineNumber,
        );

      const lineClasses = [
        "presentation-code-line",
      ];

      if (highlighted) {
        lineClasses.push(
          "presentation-code-line-highlighted",
        );
      }

      const number = element.showLineNumbers
        ? (
          `<span` +
          ` class="presentation-code-line-number"` +
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
        `<span class="presentation-code-line-content">` +
        (line === ""
          ? " "
          : typeof line === "string"
            ? renderTextContent(line, { newlineMode: "preserve" })
            : renderRichText(line, { newlineMode: "preserve" })) +
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

  const codeClass = gradientBorder
    ? " class=\"presentation-code-gradient-surface\""
    : "";

  return (
    `<pre` +
    ` class="${escapeHtml(
      classes.join(" "),
    )}"` +
    ` data-presentation-id="${escapeHtml(
      element.id,
    )}"` +
    ` data-presentation-type="code"` +
    ` data-language="${escapeHtml(
      element.language,
    )}"` +
    styleAttribute +
    `>` +
    `<code${codeClass}>` +
    content +
    `</code>` +
    `</pre>`
  );
}
