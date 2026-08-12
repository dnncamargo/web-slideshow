import { z } from "zod";

import {
  ColorSchema,
  LengthSchema,
} from "./primitives";

export const GradientStopSchema =
  z.object({
    color: ColorSchema,

    position: z
      .number()
      .min(0)
      .max(100),
  });

export type GradientStop =
  z.infer<typeof GradientStopSchema>;

const GradientStopsSchema = z
  .array(GradientStopSchema)
  .min(2)
  .max(8)
  .superRefine((stops, context) => {
    for (
      let index = 1;
      index < stops.length;
      index += 1
    ) {
      const previous =
        stops[index - 1];

      const current =
        stops[index];

      if (
        previous &&
        current &&
        current.position <
          previous.position
      ) {
        context.addIssue({
          code: "custom",

          message:
            "Gradient stops must be ordered by position.",

          path: [index, "position"],
        });
      }
    }
  });

export const LinearGradientSchema =
  z.object({
    type: z.literal("linear"),

    angle: z
      .number()
      .min(-360)
      .max(360)
      .optional(),

    stops: GradientStopsSchema,
  });

export const RadialGradientSchema =
  z.object({
    type: z.literal("radial"),

    shape: z
      .enum([
        "circle",
        "ellipse",
      ])
      .optional(),

    stops: GradientStopsSchema,
  });

export const GradientSchema =
  z.discriminatedUnion(
    "type",
    [
      LinearGradientSchema,
      RadialGradientSchema,
    ],
  );

export type Gradient =
  z.infer<typeof GradientSchema>;

export const BorderStyleSchema =
  z.enum([
    "solid",
    "dashed",
    "dotted",
  ]);

export const BorderSchema =
  z
    .object({
      width: LengthSchema,

      style:
        BorderStyleSchema.optional(),

      color:
        ColorSchema.optional(),

      gradient:
        GradientSchema.optional(),
    })
    .superRefine(
      (border, context) => {
        if (
          border.color === undefined &&
          border.gradient === undefined
        ) {
          context.addIssue({
            code: "custom",

            message:
              "Border requires either a color or a gradient.",
          });
        }

        if (
          border.color !== undefined &&
          border.gradient !== undefined
        ) {
          context.addIssue({
            code: "custom",

            message:
              "Border cannot define both color and gradient.",
          });
        }
      },
    );

export type Border =
  z.infer<typeof BorderSchema>;

export const ShadowSchema =
  z.object({
    x: LengthSchema,

    y: LengthSchema,

    blur: LengthSchema,

    spread:
      LengthSchema.optional(),

    color: ColorSchema,

    inset:
      z.boolean().optional(),
  });

export type Shadow =
  z.infer<typeof ShadowSchema>;

export const TextStrokeSchema =
  z.object({
    width: LengthSchema,

    color: ColorSchema,
  });

export type TextStroke =
  z.infer<typeof TextStrokeSchema>;
