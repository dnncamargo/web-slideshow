import { z } from "zod";

import {
  SlideSchema,
} from "./slide";
import { PresentationResourcesSchema } from "./resources";
import {
  PresentationPaletteSchema,
} from "./palette";
import { validatePresentationPaletteReferences } from "./palette-validation";
import { TypographyStylesSchema } from "./typography";
import { validatePresentationTypographyReferences } from "./typography-validation";

export {
  PresentationPaletteSchema,
} from "./palette";
export type {
  PresentationPalette,
} from "./palette";

export const PresentationSchema =
  z.object({
    schemaVersion: z.literal(1),

    id: z.string().min(1),

    title: z.string().min(1),

    description: z.string().default(""),

    aspectRatio: z.enum([
      "16:9",
      "4:3",
    ]).default("16:9"),

    resources: PresentationResourcesSchema.optional(),

    palette: PresentationPaletteSchema.optional(),

    typographyStyles: TypographyStylesSchema.optional(),

    slides: z.array(
      SlideSchema,
    ),
  })
  .strict()
  .superRefine((presentation, context) => {
    validatePresentationPaletteReferences(presentation, context);
    validatePresentationTypographyReferences(presentation, context);
  });

export type Presentation =
  z.infer<typeof PresentationSchema>;
