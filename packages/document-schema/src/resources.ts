import { z } from "zod";

export const FontFormatSchema = z.enum([
  "woff2",
  "woff",
  "truetype",
  "opentype",
]);

export const FontFamilySchema = z.string().trim().min(1);

export const FontWeightSchema = z
  .number()
  .int()
  .min(100)
  .max(900)
  .multipleOf(100);

export const FontStyleSchema = z.enum([
  "normal",
  "italic",
]);

const DISALLOWED_FONT_RESOURCE_PATH = /\.(?:css|js|mjs|cjs)$/i;

export const FontResourceUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      return false;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    if (url.hostname.toLowerCase() === "fonts.googleapis.com") {
      return false;
    }

    return !DISALLOWED_FONT_RESOURCE_PATH.test(url.pathname);
  }, "Font resource URL must use HTTP or HTTPS and reference a font file.");

export const FontResourceSourceSchema = z.object({
  type: z.literal("url"),
  url: FontResourceUrlSchema,
  format: FontFormatSchema.optional(),
});

export const FontFaceResourceSchema = z.object({
  weight: FontWeightSchema.optional(),
  style: FontStyleSchema.optional(),
  subset: z.string().trim().min(1).optional(),
  unicodeRange: z.string().min(1).optional(),
  source: FontResourceSourceSchema,
});

export const FontResourceSchema = z
  .object({
    id: z.string().trim().min(1),
    family: FontFamilySchema,
    source: FontResourceSourceSchema.optional(),
    faces: z.array(FontFaceResourceSchema).min(1).optional(),
  })
  .superRefine((fontResource, context) => {
    const hasLegacySource = fontResource.source !== undefined;
    const hasFaces = fontResource.faces !== undefined;

    if (hasLegacySource === hasFaces) {
      context.addIssue({
        code: "custom",
        message: "Font resource must define exactly one of source or faces.",
      });
    }
  });

export const PresentationResourcesSchema = z.object({
  fonts: z.array(FontResourceSchema).optional(),
});

export type FontFormat = z.infer<typeof FontFormatSchema>;
export type FontFaceResource = z.infer<typeof FontFaceResourceSchema>;
export type FontResource = z.infer<typeof FontResourceSchema>;
export type PresentationResources = z.infer<typeof PresentationResourcesSchema>;

export function getFontResourceFaces(
  fontResource: FontResource,
): readonly FontFaceResource[] {
  if (fontResource.faces !== undefined) {
    return fontResource.faces;
  }

  return fontResource.source === undefined
    ? []
    : [{ source: fontResource.source }];
}
