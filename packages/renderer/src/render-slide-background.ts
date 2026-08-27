import type {
  SlideBackground,
  SlideBackgroundPattern,
} from "@powershow/document-schema";

import {
  renderGradient,
} from "./render-visual";

import { escapeHtml } from "./escape-html";
import { renderLength } from "./render-length";
import { renderColorValue } from "./render-palette";

function renderPattern(pattern: SlideBackgroundPattern): string {
  const size = pattern.size !== undefined ? renderLength(pattern.size) : "24px";

  const color = pattern.color !== undefined ? renderColorValue(pattern.color) : "rgba(255,255,255,0.12)";

  switch (pattern.type) {
    case "dots":
      return [
        `background-image:radial-gradient(circle,${color} 1px,transparent 1px)`,
        `background-size:${size} ${size}`,
      ].join(";");

    case "grid":
      return [
        `background-image:linear-gradient(${color} 1px,transparent 1px),linear-gradient(90deg,${color} 1px,transparent 1px)`,
        `background-size:${size} ${size}`,
      ].join(";");

    case "horizontal-lines":
      return [
        `background-image:linear-gradient(${color} 1px,transparent 1px)`,
        `background-size:100% ${size}`,
      ].join(";");

    case "vertical-lines":
      return [
        `background-image:linear-gradient(90deg,${color} 1px,transparent 1px)`,
        `background-size:${size} 100%`,
      ].join(";");

    case "diagonal-lines":
      return [
        `background-image:repeating-linear-gradient(45deg,${color} 0,${color} 1px,transparent 1px,transparent ${size})`,
      ].join(";");
  }
}

export function renderSlideBackground(
  background: SlideBackground | undefined,
): string {
  const styles: string[] = [
    "position:absolute",
    "inset:0",
    "overflow:hidden",
    "pointer-events:none",
  ];

  if (background?.color) {
    styles.push(`background-color:${renderColorValue(background.color)}`);
  }

  if (background?.gradient) {
    styles.push(
      `background-image:${renderGradient(
        background.gradient,
      )}`,
    );
  }

  const children: string[] = [];

  if (background?.image) {
    children.push(
      `<img` +
        ` class="powershow-slide-background-image"` +
        ` src="${escapeHtml(background.image)}"` +
        ` alt=""` +
        ` aria-hidden="true"` +
        ` style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"` +
        `>`,
    );
  }

  if (background?.pattern) {
    const patternStyles = [
      "position:absolute",
      "inset:0",
      renderPattern(background.pattern),
    ];

    if (background.pattern.backgroundColor) {
      patternStyles.push(
        `background-color:${renderColorValue(background.pattern.backgroundColor)}`,
      );
    }

    if (background.pattern.opacity !== undefined) {
      patternStyles.push(`opacity:${background.pattern.opacity}`);
    }

    children.push(
      `<div` +
        ` class="powershow-slide-background-pattern"` +
        ` aria-hidden="true"` +
        ` style="${escapeHtml(patternStyles.join(";"))}"` +
        `></div>`,
    );
  }

  return (
    `<div` +
    ` class="powershow-slide-background"` +
    ` aria-hidden="true"` +
    ` style="${escapeHtml(styles.join(";"))}"` +
    `>` +
    children.join("") +
    `</div>`
  );
}
