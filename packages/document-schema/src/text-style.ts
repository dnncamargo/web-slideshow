import { z } from "zod";

import type { ElementTypography } from "./element-properties";
import type { TextVisualStyle } from "./element-properties";
import {
  TextStyleTypographyPropertiesSchema,
  TextStyleVisualPropertiesSchema,
} from "./element-properties";

export const FUNDAMENTAL_TEXT_STYLE_IDS = [
  "title",
  "subtitle",
  "body",
  "caption",
] as const;

export const FundamentalTextStyleIdSchema = z.enum(
  FUNDAMENTAL_TEXT_STYLE_IDS,
);

export type FundamentalTextStyleId = z.infer<
  typeof FundamentalTextStyleIdSchema
>;

export const TextStyleRoleSchema = FundamentalTextStyleIdSchema;

export type TextStyleRole = z.infer<
  typeof TextStyleRoleSchema
>;

const NonEmptyTrimmedStringSchema = z.string().trim().min(1);

export const FundamentalTextStyleOverrideSchema = z
  .object({
    id: FundamentalTextStyleIdSchema,
    style: TextStyleVisualPropertiesSchema.optional(),
    typography: TextStyleTypographyPropertiesSchema.optional(),
  })
  .strict()
  .superRefine((style, context) => {
    if (style.style !== undefined && Object.values(style.style).every((value) => value === undefined)) {
      context.addIssue({ code: "custom", path: ["style"], message: "Fundamental text style style cannot be empty." });
    }
    if (style.typography !== undefined && Object.values(style.typography).every((value) => value === undefined)) {
      context.addIssue({ code: "custom", path: ["typography"], message: "Fundamental text style typography cannot be empty." });
    }
  })
  .refine((style) => Object.values(style.style ?? {}).some((value) => value !== undefined) || Object.values(style.typography ?? {}).some((value) => value !== undefined), {
    message: "Fundamental text style override cannot be empty.",
  });

export type FundamentalTextStyleOverride = z.infer<
  typeof FundamentalTextStyleOverrideSchema
>;

export const CustomTextStyleSchema = z
  .object({
    id: NonEmptyTrimmedStringSchema.refine(
      (id) => !FundamentalTextStyleIdSchema.safeParse(id).success,
      { message: "Custom text style ID cannot be fundamental." },
    ),
    name: NonEmptyTrimmedStringSchema,
    role: TextStyleRoleSchema,
    style: TextStyleVisualPropertiesSchema.optional(),
    typography: TextStyleTypographyPropertiesSchema.optional(),
  })
  .strict()
  .superRefine((style, context) => {
    if (style.style !== undefined && Object.values(style.style).every((value) => value === undefined)) {
      context.addIssue({ code: "custom", path: ["style"], message: "Custom text style style cannot be empty." });
    }
    if (style.typography !== undefined && Object.values(style.typography).every((value) => value === undefined)) {
      context.addIssue({ code: "custom", path: ["typography"], message: "Custom text style typography cannot be empty." });
    }
  });

export type CustomTextStyle = z.infer<
  typeof CustomTextStyleSchema
>;

export const TextStyleSchema = z.union([
  FundamentalTextStyleOverrideSchema,
  CustomTextStyleSchema,
]);

export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TextStylesSchema = z
  .array(TextStyleSchema)
  .superRefine((styles, context) => {
    const ids = new Set<string>();

    styles.forEach((style, index) => {
      if (ids.has(style.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Text style IDs must be unique.",
        });
      }

      ids.add(style.id);
    });
  });

export type TextStyles = z.infer<typeof TextStylesSchema>;

export const TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textAlign",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "whiteSpace",
  "textWrapStyle",
  "overflowWrap",
  "textDecorationLine",
] as const satisfies readonly (keyof ElementTypography)[];

export const TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2 = [
  ...TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES,
  "textDecorationColor",
  "textStroke",
] as const satisfies readonly (keyof ElementTypography)[];

export const TEXT_STYLE_VISUAL_PROPERTY_NAMES = ["color"] as const;

export function stripLocalTextStyleProperties(
  style: ElementTypography | undefined,
  visualStyle: TextVisualStyle | undefined,
): { typography: ElementTypography | undefined; style: TextVisualStyle | undefined } {
  const typography = style === undefined ? undefined : Object.fromEntries(
    Object.entries(style).filter(([property, value]) => !TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2.includes(property as (typeof TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES_R2)[number]) && value !== undefined),
  ) as ElementTypography;
  const remainingStyle = visualStyle === undefined ? undefined : Object.fromEntries(
    Object.entries(visualStyle).filter(([property, value]) => property !== "color" && value !== undefined),
  );
  return {
    typography: typography && Object.keys(typography).length > 0 ? typography : undefined,
    style: remainingStyle && Object.keys(remainingStyle).length > 0 ? remainingStyle as TextVisualStyle : undefined,
  };
}

export function stripLocalTypographyFields(
  typography: ElementTypography | undefined,
): ElementTypography | undefined {
  if (typography === undefined) return undefined;

  const stripped = Object.fromEntries(
    Object.entries(typography).filter(
      ([property, value]) =>
        !TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES.includes(
          property as (typeof TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES)[number],
        ) && value !== undefined,
    ),
  ) as ElementTypography;

  return Object.keys(stripped).length > 0 ? stripped : undefined;
}

export function hasLocalTypographyFields(
  typography: ElementTypography | undefined,
): boolean {
  return typography !== undefined && TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES.some(
    (property) => typography[property] !== undefined,
  );
}
