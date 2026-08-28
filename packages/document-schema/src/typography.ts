import { z } from "zod";

import type { ElementTypography } from "./element-properties";
import {
  TypographyStylePropertiesSchema,
} from "./element-properties";

export const FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS = [
  "title",
  "subtitle",
  "body",
  "caption",
] as const;

export const FundamentalTypographyStyleIdSchema = z.enum(
  FUNDAMENTAL_TYPOGRAPHY_STYLE_IDS,
);

export type FundamentalTypographyStyleId = z.infer<
  typeof FundamentalTypographyStyleIdSchema
>;

export const TypographyStyleRoleSchema = FundamentalTypographyStyleIdSchema;

export type TypographyStyleRole = z.infer<
  typeof TypographyStyleRoleSchema
>;

const NonEmptyTrimmedStringSchema = z.string().trim().min(1);

export const FundamentalTypographyStyleOverrideSchema = z
  .object({
    id: FundamentalTypographyStyleIdSchema,
    typography: TypographyStylePropertiesSchema.refine(
      (typography) => Object.values(typography).some((value) => value !== undefined),
      { message: "Fundamental typography override cannot be empty." },
    ),
  })
  .strict();

export type FundamentalTypographyStyleOverride = z.infer<
  typeof FundamentalTypographyStyleOverrideSchema
>;

export const CustomTypographyStyleSchema = z
  .object({
    id: NonEmptyTrimmedStringSchema.refine(
      (id) => !FundamentalTypographyStyleIdSchema.safeParse(id).success,
      { message: "Custom typography style ID cannot be fundamental." },
    ),
    name: NonEmptyTrimmedStringSchema,
    role: TypographyStyleRoleSchema,
    typography: TypographyStylePropertiesSchema,
  })
  .strict();

export type CustomTypographyStyle = z.infer<
  typeof CustomTypographyStyleSchema
>;

export const TypographyStyleSchema = z.union([
  FundamentalTypographyStyleOverrideSchema,
  CustomTypographyStyleSchema,
]);

export type TypographyStyle = z.infer<typeof TypographyStyleSchema>;

export const TypographyStylesSchema = z
  .array(TypographyStyleSchema)
  .superRefine((styles, context) => {
    const ids = new Set<string>();

    styles.forEach((style, index) => {
      if (ids.has(style.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Typography style IDs must be unique.",
        });
      }

      ids.add(style.id);
    });
  });

export type TypographyStyles = z.infer<typeof TypographyStylesSchema>;

const LocalTypographyStylePropertyNames = [
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

export function hasLocalTypographyStyleProperties(
  typography: ElementTypography | undefined,
): boolean {
  return typography !== undefined && LocalTypographyStylePropertyNames.some(
    (property) => typography[property] !== undefined,
  );
}
