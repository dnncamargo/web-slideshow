import { z } from "zod";

import {
  ElementIdSchema,
  LengthSchema,
} from "./primitives";
import { ColorValueSchema } from "./palette";

import {
  PowerShowElementSchema,
} from "./elements";

import {
  GradientSchema,
} from "./visual";

export const SlideBackgroundPatternTypeSchema =
  z.enum([
    "dots",
    "grid",
    "horizontal-lines",
    "vertical-lines",
    "diagonal-lines",
  ]);

export type SlideBackgroundPatternType =
  z.infer<
    typeof SlideBackgroundPatternTypeSchema
  >;

export const SlideBackgroundPatternSchema =
  z.object({
    type: SlideBackgroundPatternTypeSchema,

    color: ColorValueSchema.optional(),

    backgroundColor:
      ColorValueSchema.optional(),

    size: LengthSchema.optional(),

    opacity: z
      .number()
      .min(0)
      .max(1)
      .optional(),
  });

export type SlideBackgroundPattern =
  z.infer<
    typeof SlideBackgroundPatternSchema
  >;

export const SlideBackgroundSchema =
  z
    .object({
      color: ColorValueSchema.optional(),

      gradient:
          GradientSchema.optional(),

      image: z
        .string()
        .min(1)
        .optional(),

      pattern:
        SlideBackgroundPatternSchema.optional(),
    })
      .superRefine(
    (background, context) => {
      if (
        background.image !== undefined &&
        (
          background.pattern !== undefined ||
          background.gradient !== undefined
        )
      ) {
        context.addIssue({
          code: "custom",

          message:
            "Slide background image cannot currently be combined with pattern or gradient.",
        });
      }
    },
  );

export type SlideBackground =
  z.infer<typeof SlideBackgroundSchema>;

export const SlideSchema = z.object({
  id: ElementIdSchema,

  title: z.string().default(""),

  summary: z.string().default(""),

  speakerNotes: z.string().default(""),

  layoutPreset: z
    .string()
    .optional(),

  elements: z
    .array(PowerShowElementSchema)
    .default([]),

  background:
    SlideBackgroundSchema.optional(),
});

export type Slide =
  z.infer<typeof SlideSchema>;
