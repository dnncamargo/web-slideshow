import { describe, expect, it } from "vitest";

import {
  CustomLibraryFontDraftSchema,
  parseCustomLibraryFontDraft,
} from "../src/features/custom-library/custom-library-font-schema";
import { translateStudioMessage } from "../src/features/i18n/studio-i18n";

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

  it.each([
    { kind: "managed-upload", assetId: "123e4567-e89b-42d3-a456-426614174000" },
    { kind: "cdn", provider: "fontsource" },
    { kind: "cdn", provider: "google-fonts" },
    { kind: "external-url" },
  ])("accepts persisted font source provenance %j", (provenance) => {
    expect(parseCustomLibraryFontDraft({
      family: "Inter",
      faces: [{ ...face, provenance }],
    }).faces[0]?.provenance).toEqual(provenance);
  });

  it("continues to accept legacy faces without provenance", () => {
    expect(parseCustomLibraryFontDraft(validDraft).faces[0]?.provenance).toBeUndefined();
  });

  it("provides the managed-removal explanation in English and Portuguese", () => {
    expect(translateStudioMessage("en", "customLibrary.fontDetails.managedRemovalBlocked")).toContain("cannot be removed from Fonts");
    expect(translateStudioMessage("pt-BR", "customLibrary.fontDetails.managedRemovalBlocked")).toContain("não podem ser removidas");
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
