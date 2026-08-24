import type {
  ContentSlot,
  Length,
} from "@powershow/document-schema";

import { quoteCssString } from "./escape-css-string";
import { renderLength } from "./render-length";
import { renderBorder } from "./render-visual";

function addLength(output: string[], property: string, value: Length | undefined): void {
  if (value !== undefined) output.push(`${property}:${renderLength(value)}`);
}
export function renderContentSlotStyle(slot: ContentSlot): string {
  const output: string[] = [];
  const layout = slot.layout;
  const style = slot.style;
  const typography = slot.typography;

  addLength(output, "padding", layout?.padding);
  addLength(output, "padding-top", layout?.paddingTop);
  addLength(output, "padding-right", layout?.paddingRight);
  addLength(output, "padding-bottom", layout?.paddingBottom);
  addLength(output, "padding-left", layout?.paddingLeft);

  if (style?.color !== undefined) output.push(`color:${style.color}`);
  if (style?.background?.color !== undefined) output.push(`background:${style.background.color}`);
  if (style?.border !== undefined) output.push(...renderBorder(style.border));
  addLength(output, "border-radius", style?.borderRadius);

  if (typography?.fontFamily !== undefined) output.push(`font-family:${quoteCssString(typography.fontFamily)}`);
  addLength(output, "font-size", typography?.fontSize);
  if (typography?.fontWeight !== undefined) output.push(`font-weight:${typography.fontWeight}`);
  if (typography?.fontStyle !== undefined) output.push(`font-style:${typography.fontStyle}`);
  if (typography?.textAlign !== undefined) output.push(`text-align:${typography.textAlign}`);
  if (typography?.lineHeight !== undefined) output.push(`line-height:${typography.lineHeight}`);
  addLength(output, "letter-spacing", typography?.letterSpacing);
  if (typography?.textTransform !== undefined) output.push(`text-transform:${typography.textTransform}`);
  if (typography?.whiteSpace !== undefined) output.push(`white-space:${typography.whiteSpace}`);
  if (typography?.textWrapStyle !== undefined) output.push(`text-wrap-style:${typography.textWrapStyle}`);
  if (typography?.overflowWrap !== undefined) output.push(`overflow-wrap:${typography.overflowWrap}`);
  if (typography?.textDecorationLine !== undefined) output.push(`text-decoration-line:${typography.textDecorationLine}`);
  if (typography?.textDecorationColor !== undefined) output.push(`text-decoration-color:${typography.textDecorationColor}`);
  if (typography?.textStroke !== undefined) {
    output.push(`-webkit-text-stroke:${renderLength(typography.textStroke.width)} ${typography.textStroke.color}`);
  }

  return output.join(";");
}
