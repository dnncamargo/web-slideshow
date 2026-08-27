import type {
  ColorValue,
  PresentationPalette,
} from "@powershow/document-schema";

import {
  isPaletteColorReference,
} from "@powershow/document-schema";

import {
  escapeCssDeclarationValue,
} from "./escape-css-string";

const HEX_RADIX = 16;
const CODE_UNIT_WIDTH = 4;

export function paletteColorCssVariableName(
  colorId: string,
): string {
  const encodedId = colorId
    .split("")
    .map((character) =>
      character
        .charCodeAt(0)
        .toString(HEX_RADIX)
        .padStart(CODE_UNIT_WIDTH, "0"),
    )
    .join("");

  return `--ps-palette-${encodedId}`;
}

export function renderColorValue(
  colorValue: ColorValue,
): string {
  return isPaletteColorReference(colorValue)
    ? `var(${paletteColorCssVariableName(colorValue.colorId)})`
    : colorValue;
}

export function renderPresentationPaletteVariables(
  palette: PresentationPalette | undefined,
): string {
  if (!palette || palette.colors.length === 0) {
    return "";
  }

  return palette.colors
    .map(
      (color) =>
        `${paletteColorCssVariableName(color.id)}:${escapeCssDeclarationValue(
          color.value,
        )}`,
    )
    .join(";");
}
