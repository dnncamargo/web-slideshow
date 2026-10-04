import { z } from "zod";

import {
  CUSTOM_LIBRARY_FILE_KINDS,
  CUSTOM_LIBRARY_FILE_REPRESENTATIONS,
  type CustomLibraryFileDraft,
  type CustomLibraryFileSource,
} from "./custom-library-file";
import { MANAGED_ASSET_CONTENT_TYPES } from "../persistence/managed-asset-content-types";

const trimmedNonEmptyString = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), "Value must be trimmed");

export const CustomLibraryFileSourceSchema: z.ZodType<CustomLibraryFileSource> = z
  .object({
    assetId: z.string().uuid(),
    storagePath: trimmedNonEmptyString,
    downloadUrl: z.url(),
    contentType: z.enum(MANAGED_ASSET_CONTENT_TYPES),
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict();

export const CustomLibraryFileDraftSchema: z.ZodType<CustomLibraryFileDraft> = z
  .object({
    name: trimmedNonEmptyString,
    kind: z.enum(CUSTOM_LIBRARY_FILE_KINDS),
    representation: z.enum(CUSTOM_LIBRARY_FILE_REPRESENTATIONS),
    source: CustomLibraryFileSourceSchema,
  })
  .strict()
  .refine(
    (value) => {
      const allowedContentTypes: Record<
        CustomLibraryFileDraft["kind"],
        readonly string[]
      > = {
        image:
          value.representation === "text"
            ? ["image/svg+xml"]
            : ["image/jpeg", "image/png", "image/webp", "image/gif"],
        audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
        font: ["font/ttf", "font/otf", "font/woff", "font/woff2"],
        text: ["text/plain"],
        markdown: ["text/markdown"],
        "structured-data": [
          "text/csv",
          "application/json",
          "application/xml",
        ],
      };

      const representationIsValid =
        value.kind === "image"
          ? value.representation === "binary" || value.representation === "text"
          : value.representation ===
            (value.kind === "audio" || value.kind === "font" ? "binary" : "text");

      return (
        representationIsValid &&
        allowedContentTypes[value.kind].includes(value.source.contentType)
      );
    },
    "File kind, representation, and content type must be compatible",
  );

export function parseCustomLibraryFileDraft(
  value: unknown,
): CustomLibraryFileDraft {
  return CustomLibraryFileDraftSchema.parse(value);
}
