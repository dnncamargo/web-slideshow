import { z } from "zod";

import { ColorSchema } from "@powershow/document-schema";

import type {
  CustomLibraryPaletteColor,
  CustomLibraryPaletteDraft,
} from "./custom-library-palette";

const trimmedNonEmptyString = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), "Value must be trimmed");

export const CustomLibraryPaletteColorSchema: z.ZodType<CustomLibraryPaletteColor> = z
  .object({
    name: trimmedNonEmptyString,
    value: ColorSchema,
  })
  .strict();

export const CustomLibraryPaletteDraftSchema: z.ZodType<CustomLibraryPaletteDraft> = z
  .object({
    name: trimmedNonEmptyString,
    description: trimmedNonEmptyString.optional(),
    colors: z.array(CustomLibraryPaletteColorSchema).min(1),
  })
  .strict();

export function parseCustomLibraryPaletteDraft(
  value: unknown,
): CustomLibraryPaletteDraft {
  return CustomLibraryPaletteDraftSchema.parse(value);
}
