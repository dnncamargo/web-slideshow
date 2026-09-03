import { formatColorAsHex, parseColor, type Color } from "@powershow/document-schema";

const MAX_PICKED_COLORS = 16;

function colorIdentity(color: Color): string {
  const parsed = parseColor(color);
  return parsed ? formatColorAsHex(parsed) : color;
}

export function arePickedColorsEquivalent(left: Color, right: Color): boolean {
  return colorIdentity(left) === colorIdentity(right);
}

export function addPickedColor(colors: readonly Color[], color: Color): readonly Color[] {
  return [color, ...colors.filter((current) => !arePickedColorsEquivalent(current, color))].slice(0, MAX_PICKED_COLORS);
}

export function removePickedColor(colors: readonly Color[], color: Color): readonly Color[] {
  return colors.filter((current) => !arePickedColorsEquivalent(current, color));
}
