import {
  formatColorAsHex,
  parseColor,
  type Color,
} from "@powershow/document-schema";

function colorIdentity(color: Color): string {
  const parsed = parseColor(color);

  return parsed ? formatColorAsHex(parsed) : color;
}

export function arePaletteColorsEquivalent(left: Color, right: Color): boolean {
  return colorIdentity(left) === colorIdentity(right);
}

export function addPaletteColor(
  colors: readonly Color[],
  color: Color,
): readonly Color[] {
  return colors.some((existingColor) =>
    arePaletteColorsEquivalent(existingColor, color),
  )
    ? colors
    : [...colors, color];
}

export function removePaletteColor(
  colors: readonly Color[],
  index: number,
): readonly Color[] {
  return colors.filter((_, colorIndex) => colorIndex !== index);
}
