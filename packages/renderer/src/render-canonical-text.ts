import type {
  ElementEffect,
  ElementTypography,
  TextElement,
  TextVisualStyle,
  TextStyleVisualProperties,
} from "@powershow/document-schema";

import { quoteCssString } from "./escape-css-string";
import { renderBorder, renderGradient, renderShadow } from "./render-visual";
import { renderLength } from "./render-length";
import { renderColorValue } from "./render-palette";

function addStyle(
  output: string[],
  property: string,
  value: string | number | undefined,
): void {
  if (value !== undefined) {
    output.push(`${property}:${value}`);
  }
}

function addLength(
  output: string[],
  property: string,
  value: Parameters<typeof renderLength>[0] | undefined,
): void {
  if (value !== undefined) {
    output.push(`${property}:${renderLength(value)}`);
  }
}

function renderLayout(element: TextElement): string[] {
  const layout = element.layout;
  const output: string[] = [];

  if (!layout) {
    return output;
  }

  addStyle(output, "position", layout.position);
  addLength(output, "top", layout.top);
  addLength(output, "right", layout.right);
  addLength(output, "bottom", layout.bottom);
  addLength(output, "left", layout.left);

  return output;
}

function renderVisualStyle(style: TextVisualStyle | undefined): string[] {
  const output: string[] = [];

  if (!style) {
    return output;
  }

  if (style.color !== undefined) addStyle(output, "color", renderColorValue(style.color));

  if (style.background?.color) {
    addStyle(output, "background", renderColorValue(style.background.color));
  }

  if (style.background?.gradient) {
    output.push(`background-image:${renderGradient(style.background.gradient)}`);
  }

  if (style.border) {
    output.push(...renderBorder(style.border));
  }

  addLength(output, "border-radius", style.borderRadius);
  return output;
}

function renderTypography(typography: ElementTypography | undefined): string[] {
  const output: string[] = [];

  if (!typography) {
    return output;
  }

  if (typography.fontFamily !== undefined) {
    output.push(`font-family:${quoteCssString(typography.fontFamily)}`);
  }

  addLength(output, "font-size", typography.fontSize);
  addStyle(output, "font-weight", typography.fontWeight);
  addStyle(output, "font-style", typography.fontStyle);
  addStyle(output, "text-align", typography.textAlign);
  addStyle(output, "line-height", typography.lineHeight);
  addLength(output, "letter-spacing", typography.letterSpacing);
  addStyle(output, "text-transform", typography.textTransform);
  addStyle(output, "white-space", typography.whiteSpace);
  addStyle(output, "text-wrap-style", typography.textWrapStyle);
  addStyle(output, "overflow-wrap", typography.overflowWrap);
  addStyle(output, "text-decoration-line", typography.textDecorationLine);
  if (typography.textDecorationColor !== undefined) addStyle(output, "text-decoration-color", renderColorValue(typography.textDecorationColor));

  if (typography.textStroke) {
    output.push(
      `-webkit-text-stroke:${renderLength(typography.textStroke.width)} ${renderColorValue(typography.textStroke.color)}`,
    );
  }

  return output;
}

function renderEffect(effect: ElementEffect | undefined): string[] {
  const output: string[] = [];

  if (!effect) {
    return output;
  }

  addStyle(output, "opacity", effect.opacity);

  if (effect.shadow) {
    output.push(`box-shadow:${renderShadow(effect.shadow)}`);
  }

  return output;
}

export function renderCanonicalTextStyle(
  element: TextElement,
  typography: ElementTypography | undefined = element.typography,
  style: TextVisualStyle | TextStyleVisualProperties | undefined = element.style,
): string {
  return [
    ...renderLayout(element),
    ...renderVisualStyle(style),
    ...renderTypography(typography),
    ...renderEffect(element.effect),
  ].join(";");
}
