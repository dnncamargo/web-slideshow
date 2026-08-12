import {
  formatColorAsHex,
  parseColor,
  type Color,
} from "@powershow/document-schema";

const MAX_RECENT_COLORS = 8;

function colorIdentity(color: Color): string {
  const parsed = parseColor(color);

  return parsed ? formatColorAsHex(parsed) : color;
}

export function areColorsEquivalent(left: Color, right: Color): boolean {
  return colorIdentity(left) === colorIdentity(right);
}

export function addRecentColor(
  colors: readonly Color[],
  color: Color,
): readonly Color[] {
  const normalized = parseColor(color) ? (color as Color) : color;

  const normalizedColors = colors.map((c) =>
    parseColor(c) ? (c as Color) : c,
  );

  const existingIndex = normalizedColors.findIndex((c) =>
    areColorsEquivalent(c, normalized),
  );

  if (existingIndex === 0) {
    return colors;
  }

  const filtered = existingIndex > 0
    ? normalizedColors.filter((_, i) => i !== existingIndex)
    : normalizedColors;

  const result = [normalized, ...filtered];

  return result.slice(0, MAX_RECENT_COLORS);
}

export function clearRecentColors(): readonly Color[] {
  return [];
}

export function moveRecentColor(
  colors: readonly Color[],
  index: number,
  direction: -1 | 1,
): readonly Color[] {
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