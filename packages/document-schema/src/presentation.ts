import { z } from "zod";

import {
  SlideSchema,
} from "./slide";

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

    slides: z.array(
      SlideSchema,
    ),
  });

export type Presentation =
  z.infer<typeof PresentationSchema>;
