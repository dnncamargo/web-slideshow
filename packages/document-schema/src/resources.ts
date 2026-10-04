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

export const HttpResourceUrlSchema = z
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

    return true;
  }, "Resource URL must use HTTP or HTTPS.");

export const FontResourceUrlSchema = HttpResourceUrlSchema.refine((value) => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
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

export const PresentationFileKindSchema = z.enum([
  "image",
  "audio",
  "font",
  "text",
  "markdown",
  "structured-data",
]);

export const PresentationFileRepresentationSchema = z.enum([
  "binary",
  "text",
]);

export const PresentationFileContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
]);

const PresentationFileResourceBaseSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  kind: PresentationFileKindSchema,
  representation: PresentationFileRepresentationSchema,
  contentType: PresentationFileContentTypeSchema,
});

export const PresentationBinaryFileResourceSchema =
  PresentationFileResourceBaseSchema.extend({
    representation: z.literal("binary"),
    source: z.object({
      type: z.literal("url"),
      url: HttpResourceUrlSchema,
    }).strict(),
  }).strict();

export const PresentationTextFileResourceSchema =
  PresentationFileResourceBaseSchema.extend({
    representation: z.literal("text"),
    source: z.object({
      type: z.literal("text"),
      content: z.string(),
    }).strict(),
  }).strict();

export const PresentationFileResourceSchema = z
  .union([
    PresentationBinaryFileResourceSchema,
    PresentationTextFileResourceSchema,
  ])
  .superRefine((resource, context) => {
    const valid = resource.representation === "binary"
      ? resource.kind === "image" && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(resource.contentType) ||
        resource.kind === "audio" && ["audio/mpeg", "audio/wav", "audio/ogg"].includes(resource.contentType) ||
        resource.kind === "font" && ["font/ttf", "font/otf", "font/woff", "font/woff2"].includes(resource.contentType)
      : resource.kind === "image" && resource.contentType === "image/svg+xml" ||
        resource.kind === "text" && resource.contentType === "text/plain" ||
        resource.kind === "markdown" && resource.contentType === "text/markdown" ||
        resource.kind === "structured-data" && ["text/csv", "application/json", "application/xml"].includes(resource.contentType);

    if (!valid) {
      context.addIssue({
        code: "custom",
        message: "File kind, representation, and content type must be compatible.",
      });
    }
  });

export const PresentationResourcesSchema = z.object({
  fonts: z.array(FontResourceSchema).optional(),
  files: z.array(PresentationFileResourceSchema).optional(),
});

export type FontFormat = z.infer<typeof FontFormatSchema>;
export type FontFaceResource = z.infer<typeof FontFaceResourceSchema>;
export type FontResource = z.infer<typeof FontResourceSchema>;
export type PresentationFileKind = z.infer<typeof PresentationFileKindSchema>;
export type PresentationFileRepresentation = z.infer<typeof PresentationFileRepresentationSchema>;
export type PresentationFileContentType = z.infer<typeof PresentationFileContentTypeSchema>;
export type PresentationBinaryFileResource = z.infer<typeof PresentationBinaryFileResourceSchema>;
export type PresentationTextFileResource = z.infer<typeof PresentationTextFileResourceSchema>;
export type PresentationFileResource = z.infer<typeof PresentationFileResourceSchema>;
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
