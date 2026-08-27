import { describe, expect, it } from "vitest";
import { PresentationSchema, type FontFaceResource, type Presentation } from "@powershow/document-schema";

import { addCustomLibraryFontToPresentation } from "../src/features/custom-library/custom-library-font-apply";

const face = (url: string, extra: Partial<FontFaceResource> = {}): FontFaceResource => ({
  weight: 400,
  style: "normal",
  subset: "latin",
  source: { type: "url", url, format: "woff2" },
  ...extra,
});

function presentation(fonts?: Presentation["resources"] extends infer R ? R extends { fonts?: infer F } ? F : never : never): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Test",
    slides: [{ id: "slide", title: "Slide", elements: [] }],
    ...(fonts ? { resources: { fonts } } : {}),
  });
}

describe("addCustomLibraryFontToPresentation", () => {
  it("adds a new family with collision-safe local identity and no provenance", () => {
    const result = addCustomLibraryFontToPresentation(
      presentation([{ id: "inter", family: "Other", faces: [face("https://example.com/other.woff2")] }]),
      { family: "Inter", faces: [face("https://example.com/inter.woff2")] },
    );
    expect(result.kind).toBe("added");
    if (result.kind !== "added") return;
    expect(result.presentation.resources?.fonts?.[1]).toEqual({
      id: "inter-2",
      family: "Inter",
      faces: [face("https://example.com/inter.woff2")],
    });
    expect(JSON.stringify(result.presentation)).not.toContain("firestore");
    expect(JSON.stringify(result.presentation)).not.toContain("provider");
  });

  it("matches normalized families and returns unchanged without rewriting legacy resources", () => {
    const original = presentation([{ id: "local", family: "Inter", source: face("https://example.com/inter.woff2").source }]);
    const result = addCustomLibraryFontToPresentation(original, { family: "Inter", faces: [{ source: face("https://example.com/inter.woff2").source }] });
    expect(result.kind).toBe("unchanged");
    expect(result.presentation).toBe(original);
  });

  it("merges only missing faces while preserving local identity and spelling", () => {
    const original = presentation([{ id: "local", family: "Inter", faces: [face("https://example.com/regular.woff2")] }]);
    const result = addCustomLibraryFontToPresentation(original, { family: " inter ", faces: [face("https://example.com/regular.woff2"), face("https://example.com/bold.woff2", { weight: 700 })] });
    expect(result.kind).toBe("merged");
    if (result.kind !== "merged") return;
    expect(result.addedFaces).toBe(1);
    expect(result.presentation.resources?.fonts?.[0]).toEqual({ id: "local", family: "Inter", faces: [face("https://example.com/regular.woff2"), face("https://example.com/bold.woff2", { weight: 700 })] });
  });

  it("collapses equivalent incoming duplicates and detects same-slot conflicts atomically", () => {
    const original = presentation([{ id: "local", family: "Inter", faces: [face("https://example.com/local.woff2")] }]);
    const duplicate = addCustomLibraryFontToPresentation(presentation(), { family: "Inter", faces: [face("https://example.com/a.woff2"), face("https://example.com/a.woff2")] });
    expect(duplicate.kind).toBe("added");
    if (duplicate.kind === "added") expect(duplicate.presentation.resources?.fonts?.[0]?.faces).toHaveLength(1);
    const conflict = addCustomLibraryFontToPresentation(original, { family: "Inter", faces: [face("https://example.com/local.woff2"), face("https://example.com/other.woff2", { weight: 400 })] });
    expect(conflict.kind).toBe("conflict");
    expect(conflict.presentation).toBe(original);
  });

  it("treats subset and unicode range as distinct slots", () => {
    const original = presentation([{ id: "local", family: "Inter", faces: [face("https://example.com/latin.woff2")] }]);
    const result = addCustomLibraryFontToPresentation(original, { family: "Inter", faces: [face("https://example.com/cyrillic.woff2", { subset: "cyrillic" }), face("https://example.com/range.woff2", { unicodeRange: "U+0000-00FF" })] });
    expect(result.kind).toBe("merged");
    if (result.kind === "merged") expect(result.addedFaces).toBe(2);
  });

  it("converts a legacy resource only when a real merge is needed", () => {
    const original = presentation([{ id: "local", family: "Inter", source: face("https://example.com/regular.woff2").source }]);
    const result = addCustomLibraryFontToPresentation(original, { family: "Inter", faces: [face("https://example.com/bold.woff2", { weight: 700 })] });
    expect(result.kind).toBe("merged");
    if (result.kind !== "merged") return;
    const resource = result.presentation.resources?.fonts?.[0];
    expect(resource).toEqual({ id: "local", family: "Inter", faces: [{ source: face("https://example.com/regular.woff2").source }, face("https://example.com/bold.woff2", { weight: 700 })] });
    expect(resource && "source" in resource).toBe(false);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
  });

  it("rejects a local-versus-incoming same-slot URL conflict", () => {
    const original = presentation([{ id: "local", family: "Inter", faces: [face("https://example.com/a.woff2")] }]);
    const result = addCustomLibraryFontToPresentation(original, { family: "Inter", faces: [face("https://example.com/b.woff2")] });
    expect(result.kind).toBe("conflict");
    expect(result.presentation).toBe(original);
  });

  it("keeps a conflict atomic after an earlier merge candidate", () => {
    const original = presentation([{ id: "local", family: "Inter", faces: [face("https://example.com/regular.woff2")] }]);
    const result = addCustomLibraryFontToPresentation(original, {
      family: "Inter",
      faces: [face("https://example.com/bold.woff2", { weight: 700 }), face("https://example.com/conflict.woff2")],
    });
    expect(result.kind).toBe("conflict");
    expect(result.presentation).toBe(original);
    expect(original.resources?.fonts?.[0]?.faces).toHaveLength(1);
  });

  it("copies all unique faces for a new family and returns a valid presentation", () => {
    const result = addCustomLibraryFontToPresentation(presentation(), {
      family: "Audiowide",
      faces: [face("https://example.com/regular.woff2"), face("https://example.com/italic.woff2", { style: "italic" }), face("https://example.com/bold.woff2", { weight: 700 })],
    });
    expect(result.kind).toBe("added");
    if (result.kind !== "added") return;
    expect(result.presentation.resources?.fonts?.[0]?.faces).toHaveLength(3);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
  });

  it("preserves unrelated data and font resource ordering during a merge", () => {
    const original = PresentationSchema.parse({
      schemaVersion: 1,
      id: "presentation",
      title: "Test",
      palette: { colors: [{ id: "accent", name: "Accent", value: "#fff" }] },
      slides: [{ id: "slide", title: "Slide", elements: [] }],
      resources: {
        fonts: [
          { id: "first", family: "First", faces: [face("https://example.com/first.woff2")] },
          { id: "inter", family: "Inter", faces: [face("https://example.com/inter.woff2")] },
          { id: "last", family: "Last", faces: [face("https://example.com/last.woff2")] },
        ],
      },
    });
    const result = addCustomLibraryFontToPresentation(original, { family: "Inter", faces: [face("https://example.com/inter-bold.woff2", { weight: 700 })] });
    expect(result.kind).toBe("merged");
    if (result.kind !== "merged") return;
    expect(result.presentation.slides).toEqual(original.slides);
    expect(result.presentation.palette).toEqual(original.palette);
    expect(result.presentation.resources?.fonts?.map((fontResource) => fontResource.id)).toEqual(["first", "inter", "last"]);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
  });
});
