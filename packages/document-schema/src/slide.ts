import { z } from "zod";

import {
  PowerShowElementSchema,
} from "./elements";

export const SlideSchema = z.object({
  id: z.string().min(1),

  title: z.string().default(""),

  summary: z.string().default(""),

  speakerNotes: z.string().default(""),

  layoutPreset: z.string().optional(),

  elements: z.array(
    PowerShowElementSchema,
  ),

  background: z
    .object({
      color: z.string().optional(),
      image: z.string().optional(),
    })
    .optional(),
});

export type Slide =
  z.infer<typeof SlideSchema>;
