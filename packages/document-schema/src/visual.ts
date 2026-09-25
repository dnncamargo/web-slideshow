import { z } from "zod";

import {
  LengthSchema,
} from "./primitives";
import { ColorValueSchema } from "./palette";

export const GradientStopSchema =
  z.object({
    color: ColorValueSchema,

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

const BackgroundPatternImageSchema =
  z
    .string()
    .refine(
      (image) => image.trim().length > 0,
      "Background pattern image cannot be empty.",
    )
    .superRefine((image, context) => {
      if (
        /\b(?:url|image-set|cross-fade|element|paint)\s*\(|@\s*import\b/i.test(
          image,
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Background pattern image must use CSS gradients only.",
        });

        return;
      }

      const variableFunctions =
        image.match(/\bvar\s*\([^)]*\)/gi) ?? [];

      if (
        variableFunctions.some(
          (variable) =>
            !/^var\s*\(\s*(?:--presentation-pattern-color-[1-4]|--presentation-pattern-background-color)\s*\)$/.test(
              variable,
            ),
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Background pattern image must use controlled color variables only.",
        });

        return;
      }

      if (!isGradientPatternImage(image)) {
        context.addIssue({
          code: "custom",
          message:
            "Background pattern image must contain only CSS gradient layers.",
        });
      }
    });

function isGradientPatternImage(image: string): boolean {
  const layers: string[] = [];
  let depth = 0;
  let layerStart = 0;

  for (let index = 0; index < image.length; index += 1) {
    const character = image[index];

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;

      if (depth < 0) {
        return false;
      }
    } else if (character === "," && depth === 0) {
      layers.push(image.slice(layerStart, index));
      layerStart = index + 1;
    }
  }

  if (depth !== 0) {
    return false;
  }

  layers.push(image.slice(layerStart));

  return layers.every(isGradientLayer);
}

function isGradientLayer(layer: string): boolean {
  const value = layer.trim();
  const match = /^(?:repeating-)?(?:linear|radial)-gradient\s*\(/i.exec(
    value,
  );

  if (!match) {
    return false;
  }

  let depth = 0;

  for (let index = match[0].length - 1; index < value.length; index += 1) {
    const character = value[index];

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;

      if (depth === 0) {
        return value.slice(index + 1).trim().length === 0;
      }
    }
  }

  return false;
}

const BackgroundPatternValueSchema =
  z.string().refine(
    (value) => value.trim().length > 0,
    "Background pattern CSS values cannot be empty.",
  );

const BackgroundPatternColorVariablePattern =
  /\bvar\s*\(\s*--presentation-pattern-color-([1-4])\s*\)/g;

function referencedPatternColorSlots(image: string): number[] {
  const slots: number[] = [];
  let match: RegExpExecArray | null;

  BackgroundPatternColorVariablePattern.lastIndex = 0;
  while ((match = BackgroundPatternColorVariablePattern.exec(image)) !== null) {
    const slot = match[1];
    if (slot !== undefined) {
      slots.push(Number(slot));
    }
  }

  return slots;
}

function patternImageContainsColor(image: string, color: string): boolean {
  const normalizedImage = image.toLowerCase();
  const normalizedColor = color.toLowerCase();

  if (normalizedImage.includes(normalizedColor)) {
    return true;
  }

  const expandedHex = /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i.exec(
    normalizedColor,
  );

  return expandedHex !== null && normalizedImage.includes(
    `#${expandedHex[1]}${expandedHex[2]}${expandedHex[3]}`,
  );
}

export const BackgroundPatternRepeatSchema =
  z.enum([
    "repeat",
    "repeat-x",
    "repeat-y",
    "no-repeat",
    "space",
    "round",
  ]);

export const BackgroundPatternSchema =
  z
    .object({
      image: BackgroundPatternImageSchema,

      size: BackgroundPatternValueSchema.optional(),

      position: BackgroundPatternValueSchema.optional(),

      repeat: BackgroundPatternRepeatSchema.optional(),

      opacity: z.number().min(0).max(1).optional(),

      colors: z.array(ColorValueSchema).min(1).max(4).optional(),

      rotation: z.number().finite().min(-360).max(360).optional(),
    })
    .superRefine((pattern, context) => {
      if (
        pattern.rotation !== undefined &&
        pattern.rotation !== 0 &&
        (pattern.repeat === "repeat-x" ||
          pattern.repeat === "repeat-y" ||
          pattern.repeat === "no-repeat")
      ) {
        context.addIssue({
          code: "custom",
          path: ["rotation"],
          message:
            "Background pattern rotation requires repetition in both axes.",
        });
      }

      const referencedSlots = new Set(
        referencedPatternColorSlots(pattern.image),
      );

      if (referencedSlots.size === 0) {
        if (pattern.colors !== undefined) {
          context.addIssue({
            code: "custom",
            path: ["colors"],
            message:
              "Background pattern colors must be referenced by the image.",
          });
        }

        return;
      }

      const highestReferencedSlot = Math.max(...referencedSlots);

      for (let slot = 1; slot <= highestReferencedSlot; slot += 1) {
        if (!referencedSlots.has(slot)) {
          context.addIssue({
            code: "custom",
            path: ["image"],
            message:
              "Background pattern color slots must be contiguous from 1.",
          });
          break;
        }
      }

      if (
        pattern.colors === undefined ||
        pattern.colors.length !== highestReferencedSlot
      ) {
        context.addIssue({
          code: "custom",
          path: ["colors"],
          message:
            "Background pattern colors must exactly match referenced slots.",
        });
      }

      if (pattern.colors !== undefined) {
        const literalColors = pattern.colors.filter(
          (color): color is string => typeof color === "string",
        );

        if (
          literalColors.some((color) =>
            patternImageContainsColor(pattern.image, color),
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["image"],
            message:
              "Parameterized background pattern colors must be authored in colors.",
          });
        }
      }
    });

export type BackgroundPattern =
  z.infer<typeof BackgroundPatternSchema>;

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
        ColorValueSchema.optional(),

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

    color: ColorValueSchema,

    inset:
      z.boolean().optional(),
  });

export type Shadow =
  z.infer<typeof ShadowSchema>;

export const TextStrokeSchema =
  z.object({
    width: LengthSchema,

    color: ColorValueSchema,
  });

export type TextStroke =
  z.infer<typeof TextStrokeSchema>;
