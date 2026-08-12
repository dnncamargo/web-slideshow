import { z } from "zod";

import {
  SlideSchema,
} from "./slide";
import { PresentationResourcesSchema } from "./resources";
import { ColorSchema } from "./primitives";

export const PresentationPaletteSchema =
  z.object({
    colors: z.array(ColorSchema),
  });

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

    slides: z.array(
      SlideSchema,
    ),
  });

export type Presentation =
  z.infer<typeof PresentationSchema>;

export type PresentationPalette =
  z.infer<typeof PresentationPaletteSchema>;
