import { z } from "zod";

import {
  FontFaceResourceSchema,
  type FontFaceResource,
} from "@powershow/document-schema";

import type { CustomLibraryFontDraft } from "./custom-library-font";

const trimmedNonEmptyString = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), "Value must be trimmed");

export const CustomLibraryFontDraftSchema: z.ZodType<CustomLibraryFontDraft> = z
  .object({
    family: trimmedNonEmptyString,
    faces: z.array(FontFaceResourceSchema).min(1),
  })
  .strict();

export function parseCustomLibraryFontDraft(
  value: unknown,
): CustomLibraryFontDraft {
  return CustomLibraryFontDraftSchema.parse(value);
}

export type { FontFaceResource };
