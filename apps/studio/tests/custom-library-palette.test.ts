import { describe, expect, it } from "vitest";

import type { PresentationPalette } from "@powershow/document-schema";

import {
  createCustomLibraryPaletteDraft,
} from "../src/features/custom-library/custom-library-palette";
import {
  CustomLibraryPaletteColorSchema,
  CustomLibraryPaletteDraftSchema,
  parseCustomLibraryPaletteDraft,
} from "../src/features/custom-library/custom-library-palette-schema";

const palette = (colors: PresentationPalette["colors"]): PresentationPalette => ({ colors });
const color = (id: string, name: string, value: string) => ({ id, name, value });
const validDraft = {
  name: "Brand",
  colors: [{ name: "Accent", value: "#facc15" }],
};

const expectInvalid = (value: unknown) => {
  expect(() => parseCustomLibraryPaletteDraft(value)).toThrow();
};

describe("Custom Library Palette persisted contract", () => {
  it("parses valid HEX, RGBA, optional description, and preserves order", () => {
    expect(parseCustomLibraryPaletteDraft({
      name: "Brand",
      description: "A reusable palette",
      colors: [
        { name: "Text", value: "#ffffff" },
        { name: "Overlay", value: "rgba(10, 20, 30, 0.5)" },
      ],
    })).toEqual({
      name: "Brand",
      description: "A reusable palette",
      colors: [
        { name: "Text", value: "#ffffff" },
        { name: "Overlay", value: "rgba(10, 20, 30, 0.5)" },
      ],
    });
  });

  it.each(["", " ", " Brand"]) ("requires a trimmed non-empty palette name: %j", (name) => {
    expectInvalid({ ...validDraft, name });
  });

  it.each(["", " ", " Description"]) ("rejects invalid persisted descriptions: %j", (description) => {
    expectInvalid({ ...validDraft, description });
  });

  it.each(["", " ", " Accent"]) ("requires a trimmed non-empty color name: %j", (name) => {
    expectInvalid({ ...validDraft, colors: [{ name, value: "#fff" }] });
  });

  it("preserves ColorSchema normalization and rejects invalid colors", () => {
    expect(parseCustomLibraryPaletteDraft({
      ...validDraft,
      colors: [{ name: "Accent", value: " #fff " }],
    }).colors[0]?.value).toBe("#ffffff");
    expectInvalid({ ...validDraft, colors: [{ name: "Accent", value: "not-a-color" }] });
  });

  it("rejects palette references and unknown properties", () => {
    expectInvalid({
      ...validDraft,
      colors: [{ name: "Accent", value: { kind: "palette", colorId: "accent" } }],
    });
    expectInvalid({ ...validDraft, extra: true });
    expectInvalid({ ...validDraft, colors: [{ name: "Accent", value: "#fff", id: "accent" }] });
    expect(() => CustomLibraryPaletteColorSchema.parse({ name: "Accent", value: "#fff", id: "accent" })).toThrow();
  });

  it("requires at least one color and accepts duplicate names and values", () => {
    expectInvalid({ name: "Empty", colors: [] });
    expect(parseCustomLibraryPaletteDraft({
      name: "Duplicates",
      colors: [
        { name: "Accent", value: "#fff" },
        { name: "Accent", value: "#fff" },
      ],
    }).colors).toHaveLength(2);
    expect(CustomLibraryPaletteDraftSchema.parse(validDraft)).toEqual(validDraft);
  });
});

describe("createCustomLibraryPaletteDraft", () => {
  it("normalizes metadata, strips presentation ids, preserves order, and clones values", () => {
    const source = palette([
      color("accent-local-id", " Accent ", "#facc15"),
      color("text-local-id", "Accent", "rgba(0, 0, 0, 0.5)"),
    ]);

    const draft = createCustomLibraryPaletteDraft({
      name: "  Brand  ",
      description: "  Reusable  ",
      palette: source,
    });

    expect(draft).toEqual({
      name: "Brand",
      description: "Reusable",
      colors: [
        { name: "Accent", value: "#facc15" },
        { name: "Accent", value: "rgba(0, 0, 0, 0.5)" },
      ],
    });
    expect(JSON.stringify(draft)).not.toContain("accent-local-id");
    expect(JSON.stringify(draft)).not.toContain("text-local-id");
    expect(source).toEqual(palette([
      color("accent-local-id", " Accent ", "#facc15"),
      color("text-local-id", "Accent", "rgba(0, 0, 0, 0.5)"),
    ]));
    expect(parseCustomLibraryPaletteDraft(draft)).toEqual(draft);
  });

  it("omits blank descriptions and rejects empty metadata or source palettes", () => {
    expect(createCustomLibraryPaletteDraft({
      name: "Brand",
      description: "   ",
      palette: palette([color("accent", "Accent", "#fff")]),
    })).not.toHaveProperty("description");
    expect(() => createCustomLibraryPaletteDraft({ name: " ", palette: palette([color("accent", "Accent", "#fff")]) }))
      .toThrow("palette name must not be empty");
    expect(() => createCustomLibraryPaletteDraft({ name: "Brand", palette: palette([]) }))
      .toThrow("must contain at least one color");
    expect(() => createCustomLibraryPaletteDraft({ name: "Brand", palette: palette([color("accent", " ", "#fff")]) }))
      .toThrow("color name must not be empty");
  });
});
