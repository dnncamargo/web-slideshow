import { formatColorAsHex, parseColor, type Color } from "@powershow/document-schema";

function colorIdentity(color: Color): string {
  const parsed = parseColor(color);
  return parsed ? formatColorAsHex(parsed) : color;
}

export function arePickedColorsEquivalent(left: Color, right: Color): boolean {
  return colorIdentity(left) === colorIdentity(right);
}

export function addPickedColor(colors: readonly Color[], color: Color): readonly Color[] {
  if (colors.some((current) => arePickedColorsEquivalent(current, color))) return colors;
  return [color, ...colors];
}

export function removePickedColor(colors: readonly Color[], color: Color): readonly Color[] {
  return colors.filter((current) => !arePickedColorsEquivalent(current, color));
}
