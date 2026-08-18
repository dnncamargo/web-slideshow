import { z } from "zod";

// ============================================================
// BEGIN: ELEMENT LINKS
//
// Links are a per-element, additive capability.
//
// V1 supports absolute HTTP/HTTPS URL links only.
//
// kind:"url" is intentionally additive: future kinds such as
// "page", "email" or "telephone" can be introduced later without
// changing the shape of existing documents.
// ============================================================

export function isAbsoluteHttpHref(value: string): boolean {
  // The canonical href must already be written as an explicit absolute URL.
  // Do not accept or silently normalize surrounding whitespace.
  if (value !== value.trim()) {
    return false;
  }

  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const ElementLinkSchema = z.object({
  kind: z.literal("url"),

  href: z.string().refine(isAbsoluteHttpHref, {
    message: "href must be an absolute http:// or https:// URL.",
  }),

  target: z.enum(["_self", "_blank"]).optional(),
});

export type ElementLink = z.infer<typeof ElementLinkSchema>;

// ============================================================
// END: ELEMENT LINKS
// ============================================================
