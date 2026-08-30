import { z } from "zod";

import {
  SlideSchema,
} from "./slide";
import { PresentationResourcesSchema } from "./resources";
import {
  PresentationPaletteSchema,
} from "./palette";
import { validatePresentationPaletteReferences } from "./palette-validation";
import { TextStylesSchema } from "./text-style";
import { validatePresentationTextStyleReferences } from "./text-style-validation";
import { LinkedContainerStylesSchema } from "./linked-style";
import { validatePresentationLinkedStyleReferences } from "./linked-style-validation";

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

    textStyles: TextStylesSchema.optional(),

    linkedStyles: LinkedContainerStylesSchema.optional(),

    slides: z.array(
      SlideSchema,
    ),
  })
  .strict()
  .superRefine((presentation, context) => {
    validatePresentationPaletteReferences(presentation, context);
    validatePresentationTextStyleReferences(presentation, context);
    validatePresentationLinkedStyleReferences(presentation, context);
  });

export type Presentation =
  z.infer<typeof PresentationSchema>;
