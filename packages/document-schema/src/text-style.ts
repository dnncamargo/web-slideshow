import { z } from "zod";

import type { ElementTypography } from "./element-properties";
import {
  TypographyStylePropertiesSchema,
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
    typography: TypographyStylePropertiesSchema.refine(
      (typography) => Object.values(typography).some((value) => value !== undefined),
      { message: "Fundamental typography override cannot be empty." },
    ),
  })
  .strict();

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
    typography: TypographyStylePropertiesSchema.optional().refine(
      (typography) => typography === undefined || Object.keys(typography).length > 0,
      { message: "Custom text style typography cannot be empty." },
    ),
  })
  .strict();

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

export const TYPOGRAPHY_STYLE_V1_PROPERTY_NAMES = [
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

export function stripLocalTypographyStyleProperties(
  typography: ElementTypography | undefined,
): ElementTypography | undefined {
  if (typography === undefined) return undefined;

  const stripped = Object.fromEntries(
    Object.entries(typography).filter(
      ([property, value]) =>
        !TYPOGRAPHY_STYLE_V1_PROPERTY_NAMES.includes(
          property as (typeof TYPOGRAPHY_STYLE_V1_PROPERTY_NAMES)[number],
        ) && value !== undefined,
    ),
  ) as ElementTypography;

  return Object.keys(stripped).length > 0 ? stripped : undefined;
}

export function hasLocalTypographyStyleProperties(
  typography: ElementTypography | undefined,
): boolean {
  return typography !== undefined && TYPOGRAPHY_STYLE_V1_PROPERTY_NAMES.some(
    (property) => typography[property] !== undefined,
  );
}
