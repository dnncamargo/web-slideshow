import {
  formatColorAsHex,
  parseColor,
  type Color,
  type PresentationPaletteColor,
} from "@powershow/document-schema";

function colorIdentity(color: Color): string {
  const parsed = parseColor(color);

  return parsed ? formatColorAsHex(parsed) : color;
}

export function areColorsEquivalent(left: Color, right: Color): boolean {
  return colorIdentity(left) === colorIdentity(right);
}

export function arePaletteColorsEquivalent(
  left: PresentationPaletteColor,
  right: Color,
): boolean {
  return areColorsEquivalent(left.value, right);
}

export function addPaletteColor(
  colors: readonly PresentationPaletteColor[],
  color: Color,
): readonly PresentationPaletteColor[] {
  const normalized = parseColor(color) ? (color as Color) : color;

  const existingIndex = colors.findIndex((c) =>
    arePaletteColorsEquivalent(c, normalized),
  );

  if (existingIndex === -1) {
    const id = colorIdentity(normalized);

    return [
      ...colors,
      { id, name: id, value: normalized },
    ];
  }

  return colors;
}

export function removePaletteColor(
  colors: readonly PresentationPaletteColor[],
  index: number,
): readonly PresentationPaletteColor[] {
  return colors.filter((_, colorIndex) => colorIndex !== index);
}

export function movePaletteColor(
  colors: readonly PresentationPaletteColor[],
  index: number,
  direction: -1 | 1,
): readonly PresentationPaletteColor[] {
  const targetIndex = index + direction;

  if (
    targetIndex < 0 ||
    targetIndex >= colors.length ||
    index < 0 ||
    index >= colors.length
  ) {
    return colors;
  }

  const result = [...colors];
  const temp = result[index];
  result[index] = result[targetIndex];
  result[targetIndex] = temp;

  return result;
}
