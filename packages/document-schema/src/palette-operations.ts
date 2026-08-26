import { ColorSchema } from "./primitives";
import type { Presentation } from "./presentation";
import {
  findPaletteColor,
  isPaletteColorReference,
  type ColorValue,
  type PaletteColorReference,
  type PresentationPaletteColor,
} from "./palette";
import { mapPresentationColorValues } from "./palette-validation";

export { mapPresentationColorValues, mapPowerShowElementColorValues } from "./palette-validation";

export type PaletteOperationFailure = {
  ok: false;
  reason: "color-not-found" | "invalid-color" | "invalid-name" | "reference-not-found";
};

export type PaletteOperationSuccess<T extends object = object> = {
  ok: true;
} & T;

function parseLiteralColor(value: string): string | undefined {
  const result = ColorSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function resultForColor(
  presentation: Presentation,
  colorId: string,
  update: (color: PresentationPaletteColor) => PresentationPaletteColor,
): PaletteOperationSuccess<{ presentation: Presentation }> | PaletteOperationFailure {
  if (!presentation.palette || !findPaletteColor(presentation.palette, colorId)) {
    return { ok: false, reason: "color-not-found" };
  }

  return {
    ok: true,
    presentation: {
      ...presentation,
      palette: {
        ...presentation.palette,
        colors: presentation.palette.colors.map((color) =>
          color.id === colorId ? update(color) : color,
        ),
      },
    },
  };
}

export function updatePresentationPaletteColorValue(
  presentation: Presentation,
  colorId: string,
  nextColor: string,
): PaletteOperationSuccess<{ presentation: Presentation }> | PaletteOperationFailure {
  const value = parseLiteralColor(nextColor);
  if (value === undefined) return { ok: false, reason: "invalid-color" };
  return resultForColor(presentation, colorId, (color) => ({ ...color, value }));
}

export function renamePresentationPaletteColor(
  presentation: Presentation,
  colorId: string,
  nextName: string,
): PaletteOperationSuccess<{ presentation: Presentation }> | PaletteOperationFailure {
  const name = nextName.trim();
  if (name.length === 0) return { ok: false, reason: "invalid-name" };
  return resultForColor(presentation, colorId, (color) => ({ ...color, name }));
}

function createPaletteColorId(name: string, colors: readonly PresentationPaletteColor[]): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "color";
  const ids = new Set(colors.map((color) => color.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function addPresentationPaletteColor(
  presentation: Presentation,
  name: string,
  value: string,
): PaletteOperationSuccess<{ presentation: Presentation; color: PresentationPaletteColor }> | PaletteOperationFailure {
  const trimmedName = name.trim();
  const normalizedValue = parseLiteralColor(value);
  if (trimmedName.length === 0) return { ok: false, reason: "invalid-name" };
  if (normalizedValue === undefined) return { ok: false, reason: "invalid-color" };

  const colors = presentation.palette?.colors ?? [];
  const color: PresentationPaletteColor = {
    id: createPaletteColorId(trimmedName, colors),
    name: trimmedName,
    value: normalizedValue,
  };
  return {
    ok: true,
    color,
    presentation: {
      ...presentation,
      palette: { colors: [...colors, color] },
    },
  };
}

export function linkColorToPalette(colorId: string): PaletteColorReference {
  return { kind: "palette", colorId };
}

export function detachColorValue(
  value: ColorValue,
  palette: Presentation["palette"],
): string | undefined {
  if (!isPaletteColorReference(value)) return value;
  return findPaletteColor(palette, value.colorId)?.value;
}

export function removePresentationPaletteColor(
  presentation: Presentation,
  colorId: string,
): PaletteOperationSuccess<{ presentation: Presentation; detachedCount: number }> | PaletteOperationFailure {
  const color = findPaletteColor(presentation.palette, colorId);
  if (!color) return { ok: false, reason: "color-not-found" };

  let detachedCount = 0;
  const mapped = mapPresentationColorValues(presentation, (value) => {
    if (isPaletteColorReference(value) && value.colorId === colorId) {
      detachedCount += 1;
      return color.value;
    }
    return value;
  });
  return {
    ok: true,
    detachedCount,
    presentation: {
      ...mapped,
      palette: {
        colors: mapped.palette?.colors.filter((entry) => entry.id !== colorId) ?? [],
      },
    },
  };
}

export type { PaletteColorReference };
