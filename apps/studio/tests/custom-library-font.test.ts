import { describe, expect, it } from "vitest";

import {
  CustomLibraryFontDraftSchema,
  parseCustomLibraryFontDraft,
} from "../src/features/custom-library/custom-library-font-schema";

const face = {
  weight: 400,
  style: "normal" as const,
  subset: "latin",
  unicodeRange: "U+0000-00FF",
  source: {
    type: "url" as const,
    url: "https://cdn.example.test/font.woff2",
    format: "woff2" as const,
  },
};

const validDraft = { family: "Inter", faces: [face] };

describe("Custom Library Font persisted contract", () => {
  it("accepts a valid family with one canonical face", () => {
    expect(parseCustomLibraryFontDraft(validDraft)).toEqual(validDraft);
  });

  it("accepts multiple canonical faces with weights, styles, and subsets", () => {
    expect(parseCustomLibraryFontDraft({
      family: "Source Sans 3",
      faces: [face, { ...face, weight: 700, style: "italic", subset: "cyrillic" }],
    }).faces).toHaveLength(2);
  });

  it.each([" Inter", "Inter ", ""]) ("rejects an untrimmed or empty family: %j", (family) => {
    expect(() => parseCustomLibraryFontDraft({ ...validDraft, family })).toThrow();
  });

  it("rejects zero faces", () => {
    expect(() => parseCustomLibraryFontDraft({ family: "Inter", faces: [] })).toThrow();
  });

  it("rejects malformed faces through canonical validation", () => {
    expect(() => parseCustomLibraryFontDraft({
      family: "Inter",
      faces: [{ source: { type: "url", url: "not-a-url" } }],
    })).toThrow();
  });

  it("rejects unknown metadata, provenance, and Presentation-local IDs", () => {
    expect(() => parseCustomLibraryFontDraft({ ...validDraft, extra: true })).toThrow();
    expect(() => parseCustomLibraryFontDraft({ ...validDraft, provider: "google-fonts" })).toThrow();
    expect(() => parseCustomLibraryFontDraft({ ...validDraft, id: "presentation-font-id" })).toThrow();
  });

  it("keeps the schema strict and exposes the canonical parsed shape", () => {
    expect(CustomLibraryFontDraftSchema.parse(validDraft)).toEqual(validDraft);
  });
});
