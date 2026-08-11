import { z } from "zod";

export const FontFormatSchema = z.enum([
  "woff2",
  "woff",
  "truetype",
  "opentype",
]);

export const FontFamilySchema = z.string().trim().min(1);

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

export const FontResourceSchema = z.object({
  id: z.string().trim().min(1),
  family: FontFamilySchema,
  source: FontResourceSourceSchema,
});

export const PresentationResourcesSchema = z.object({
  fonts: z.array(FontResourceSchema).optional(),
});

export type FontFormat = z.infer<typeof FontFormatSchema>;
export type FontResource = z.infer<typeof FontResourceSchema>;
export type PresentationResources = z.infer<typeof PresentationResourcesSchema>;
