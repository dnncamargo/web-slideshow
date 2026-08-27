import { z } from "zod";

import {
  ColorSchema,
} from "./primitives";

export const PaletteColorReferenceSchema = z
  .object({
    kind: z.literal("palette"),
    colorId: z.string().trim().min(1),
  })
  .strict();

export type PaletteColorReference = z.infer<
  typeof PaletteColorReferenceSchema
>;

export const ColorValueSchema = z.union([
  ColorSchema,
  PaletteColorReferenceSchema,
]);

export type ColorValue = z.infer<typeof ColorValueSchema>;

export const PresentationPaletteColorSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    value: ColorSchema,
  })
  .strict();

export type PresentationPaletteColor = z.infer<
  typeof PresentationPaletteColorSchema
>;

export const PresentationPaletteSchema = z
  .object({
    colors: z.array(PresentationPaletteColorSchema),
  })
  .strict()
  .superRefine((palette, context) => {
    const colorIds = new Set<string>();

    palette.colors.forEach((color, index) => {
      if (colorIds.has(color.id)) {
        context.addIssue({
          code: "custom",
          path: ["colors", index, "id"],
          message: "Palette color ids must be unique.",
        });
      }

      colorIds.add(color.id);
    });
  });

export type PresentationPalette = z.infer<
  typeof PresentationPaletteSchema
>;

export function isPaletteColorReference(
  value: ColorValue,
): value is PaletteColorReference {
  return (
    typeof value === "object" &&
    value !== null &&
    value.kind === "palette"
  );
}

export function findPaletteColor(
  palette: { colors: readonly PresentationPaletteColor[] } | undefined,
  colorId: string,
): PresentationPaletteColor | undefined {
  return palette?.colors.find((color) => color.id === colorId);
}

export function resolveColorValue(
  value: ColorValue,
  palette: { colors: readonly PresentationPaletteColor[] } | undefined,
): string | undefined {
  if (!isPaletteColorReference(value)) {
    return value;
  }

  return findPaletteColor(palette, value.colorId)?.value;
}
