import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  linkColorToPalette,
} from "@powershow/document-schema";

import { addCustomLibraryPaletteToPresentation } from "../src/features/custom-library/custom-library-palette-apply";
import type { CustomLibraryPaletteDraft } from "../src/features/custom-library/custom-library-palette";

const defaultsInput = {
  schemaVersion: 1 as const,
  id: "presentation-fixture",
  title: "Fixture presentation",
  slides: [],
};

const presentation = (colors?: Array<{ id: string; name: string; value: string }>) =>
  PresentationSchema.parse({
    ...defaultsInput,
    ...(colors === undefined ? {} : { palette: { colors } }),
    slides: [],
  });

const libraryPalette = (colors: Array<{ name: string; value: string }>): CustomLibraryPaletteDraft => ({
  name: "Brand Warm",
  description: "Reusable colors",
  colors,
});

describe("addCustomLibraryPaletteToPresentation", () => {
  it("creates a local palette when the Presentation has none", () => {
    const result = addCustomLibraryPaletteToPresentation(
      presentation(),
      libraryPalette([
        { name: "Accent", value: "#facc15" },
        { name: "Surface", value: "#0f172a" },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.palette?.colors).toEqual([
      { id: "accent", name: "Accent", value: "#facc15" },
      { id: "surface", name: "Surface", value: "#0f172a" },
    ]);
    expect(result.addedColors).toEqual(result.presentation.palette?.colors);
  });

  it("preserves existing entries and appends Library colors in exact order", () => {
    const result = addCustomLibraryPaletteToPresentation(
      presentation([{ id: "existing", name: "Existing", value: "#ff0000" }]),
      libraryPalette([
        { name: "B", value: "#0000ff" },
        { name: "A", value: "#00ff00" },
        { name: "C", value: "#ffffff" },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.palette?.colors.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "existing", name: "Existing" },
      { id: "b", name: "B" },
      { id: "a", name: "A" },
      { id: "c", name: "C" },
    ]);
  });

  it("uses canonical collision semantics for repeated and duplicate names", () => {
    const result = addCustomLibraryPaletteToPresentation(
      presentation([
        { id: "accent", name: "Accent", value: "#ff0000" },
        { id: "accent-2", name: "Existing", value: "#00ff00" },
      ]),
      libraryPalette([
        { name: "Accent", value: "#facc15" },
        { name: "Accent", value: "#facc15" },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.addedColors).toEqual([
      { id: "accent-3", name: "Accent", value: "#facc15" },
      { id: "accent-4", name: "Accent", value: "#facc15" },
    ]);
  });

  it("does not reuse entries by name or visual value", () => {
    const result = addCustomLibraryPaletteToPresentation(
      presentation([{ id: "accent", name: "Accent", value: "#ffffff" }]),
      libraryPalette([
        { name: "Accent", value: "#ffffff" },
        { name: "Border", value: "#ffffff" },
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.addedColors.map((color) => color.id)).toEqual(["accent-2", "border"]);
    expect(result.presentation.palette?.colors).toHaveLength(3);
  });

  it("keeps existing palette references and excludes Library metadata", () => {
    const reference = linkColorToPalette("accent");
    const source = PresentationSchema.parse({
      ...defaultsInput,
      palette: { colors: [{ id: "accent", name: "Accent", value: "#ff0000" }] },
      slides: [{
        id: "slide",
        elements: [{ id: "text", type: "text", content: "Text", style: { color: reference } }],
      }],
    });
    const before = structuredClone(source);
    const result = addCustomLibraryPaletteToPresentation(source, libraryPalette([
      { name: "Accent", value: "#facc15" },
    ]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.slides[0]?.elements[0]).toEqual(source.slides[0]?.elements[0]);
    expect(JSON.stringify(result.presentation)).not.toContain("Brand Warm");
    expect(JSON.stringify(result.presentation)).not.toContain("Reusable colors");
    expect(JSON.stringify(result.presentation)).not.toContain("customLibraryPalette");
    expect(source).toEqual(before);
  });

  it("returns an explicit failure without returning a partial Presentation", () => {
    const source = presentation();
    const before = structuredClone(source);
    const result = addCustomLibraryPaletteToPresentation(source, libraryPalette([
      { name: "Valid", value: "#ffffff" },
      { name: "", value: "#000000" },
    ] as never));

    expect(result).toEqual({ ok: false, reason: "invalid-name" });
    expect(source).toEqual(before);
  });

  it("returns a Presentation accepted by the canonical schema", () => {
    const result = addCustomLibraryPaletteToPresentation(
      presentation(),
      libraryPalette([{ name: "Accent", value: "rgba(10, 20, 30, 0.5)" }]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
    expect(result.addedColors).toHaveLength(1);
  });
});
