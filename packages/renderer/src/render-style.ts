import type { ElementStyle, Length } from "@powershow/document-schema";

import { renderBorder, renderGradient, renderShadow } from "./render-visual";

import { renderLength } from "./render-length";

function addStyle(
  target: string[],
  property: string,
  value: string | number | undefined,
): void {
  if (value === undefined) {
    return;
  }

  target.push(`${property}:${value}`);
}

function addLength(
  target: string[],
  property: string,
  value: Length | undefined,
): void {
  if (value === undefined) {
    return;
  }

  target.push(`${property}:${renderLength(value)}`);
}

export function renderStyle(style: ElementStyle | undefined): string {
  if (!style) {
    return "";
  }

  const output: string[] = [];

  addLength(output, "width", style.width);
  addLength(output, "height", style.height);

  addLength(output, "min-width", style.minWidth);

  addLength(output, "min-height", style.minHeight);

  addLength(output, "max-width", style.maxWidth);

  addLength(output, "max-height", style.maxHeight);

  addLength(output, "margin", style.margin);

  addLength(output, "margin-top", style.marginTop);

  addLength(output, "margin-right", style.marginRight);

  addLength(output, "margin-bottom", style.marginBottom);

  addLength(output, "margin-left", style.marginLeft);

  addLength(output, "padding", style.padding);

  addLength(output, "padding-top", style.paddingTop);

  addLength(output, "padding-right", style.paddingRight);

  addLength(output, "padding-bottom", style.paddingBottom);

  addLength(output, "padding-left", style.paddingLeft);

  addStyle(output, "position", style.position);

  addLength(output, "top", style.top);
  addLength(output, "right", style.right);
  addLength(output, "bottom", style.bottom);
  addLength(output, "left", style.left);

  addStyle(output, "background", style.background);

  addStyle(output, "color", style.color);

  addLength(output, "font-size", style.fontSize);

  addStyle(output, "font-weight", style.fontWeight);

  addStyle(output, "font-style", style.fontStyle);

  addStyle(output, "text-align", style.textAlign);

  addStyle(output, "line-height", style.lineHeight);

  addLength(output, "letter-spacing", style.letterSpacing);

  addLength(output, "border-radius", style.borderRadius);

  addStyle(output, "opacity", style.opacity);

  addStyle(output, "overflow", style.overflow);

  if (style.backgroundGradient) {
    output.push(`background-image:${renderGradient(style.backgroundGradient)}`);
  }

  if (style.shadow) {
    output.push(`box-shadow:${renderShadow(style.shadow)}`);
  }

  if (style.border) {
    output.push(...renderBorder(style.border));
  }

  return output.join(";");
}
