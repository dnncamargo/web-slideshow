import { describe, expect, it } from "vitest";
import { PresentationSchema, type FontFaceResource, type Presentation } from "@powershow/document-schema";

import { applyCustomLibraryItemToPresentation } from "../src/features/custom-library/custom-library-item-apply";
import type { CustomLibraryItemDraft } from "../src/features/custom-library/custom-library-item";

const face = (url: string, extra: Partial<FontFaceResource> = {}): FontFaceResource => ({
  weight: 400,
  style: "normal",
  subset: "latin",
  source: { type: "url", url, format: "woff2" },
  ...extra,
});

function presentation(elements = [], fonts?: NonNullable<Presentation["resources"]>["fonts"]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "item-apply",
    title: "Item apply",
    slides: [{ id: "slide", title: "Slide", elements }],
    ...(fonts ? { resources: { fonts } } : {}),
  });
}

const textRecipe = (fontFamily?: string) => ({
  type: "text" as const,
  properties: [
    { path: "content", value: "Applied" },
    ...(fontFamily ? [{ path: "typography.fontFamily", value: fontFamily }] : []),
  ],
});

function item(root: CustomLibraryItemDraft["root"], fonts?: CustomLibraryItemDraft["dependencies"]): CustomLibraryItemDraft {
  return { name: "Style", root, ...(fonts ? { dependencies: fonts } : {}) };
}

describe("applyCustomLibraryItemToPresentation", () => {
  it("applies legacy items without inventing resources", () => {
    const original = presentation();
    const style = item(textRecipe());
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toMatchObject({ ok: true, mode: "create-root" });
    if (!result.ok) return;
    expect(result.presentation.resources).toBeUndefined();
    expect(original).toEqual(presentation());
    expect(style).toEqual(item(textRecipe()));
  });

  it("materializes a missing font and places the authored recipe", () => {
    const original = presentation();
    const style = item(textRecipe("Fira Code"), { fonts: [{ family: "Fira Code", faces: [face("https://example.com/fira.woff2")] }] });
    const presentationBefore = structuredClone(original);
    const itemBefore = structuredClone(style);
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("create-root");
    const appliedElement = result.presentation.slides[0]?.elements[0];
    expect(appliedElement).toMatchObject({ type: "text", typography: { fontFamily: "Fira Code" } });
    expect(result.appliedElementId).toBe(appliedElement?.id);
    expect(result.presentation.resources?.fonts).toHaveLength(1);
    const resultFace = result.presentation.resources?.fonts?.[0]?.faces?.[0];
    const dependencyFace = style.dependencies?.fonts?.[0]?.faces[0];
    expect(resultFace).toBeDefined();
    expect(dependencyFace).toBeDefined();
    expect(resultFace).not.toBe(dependencyFace);
    expect(resultFace?.source).not.toBe(dependencyFace?.source);
    expect(original).toEqual(presentationBefore);
    expect(style).toEqual(itemBefore);
  });

  it("reuses an equivalent resource and merges missing faces", () => {
    const original = presentation([], [{ id: "fira-local", family: "Fira Code", faces: [face("https://example.com/regular.woff2")] }]);
    const style = item(textRecipe("Fira Code"), { fonts: [{ family: "fira code", faces: [face("https://example.com/regular.woff2"), face("https://example.com/bold.woff2", { weight: 700 })] }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.resources?.fonts).toHaveLength(1);
    expect(result.presentation.resources?.fonts?.[0]).toMatchObject({ id: "fira-local" });
    expect(result.presentation.resources?.fonts?.[0]?.faces).toHaveLength(2);
  });

  it("rejects a font conflict without changing the original", () => {
    const original = presentation([], [{ id: "fira-local", family: "Fira Code", faces: [face("https://example.com/local.woff2")] }]);
    const before = structuredClone(original);
    const style = item(textRecipe("Fira Code"), { fonts: [{ family: "fira code", faces: [face("https://example.com/other.woff2")] }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toEqual({ ok: false, reason: "font-dependency-conflict" });
    expect(original).toEqual(before);
    expect(original.slides[0]?.elements).toHaveLength(0);
  });

  it("rolls back earlier dependencies when a later dependency conflicts", () => {
    const original = presentation([], [{ id: "inter-local", family: "Inter", faces: [face("https://example.com/inter-local.woff2")] }]);
    const style = item(textRecipe("Fira Code"), { fonts: [
      { family: "Fira Code", faces: [face("https://example.com/fira.woff2")] },
      { family: "Inter", faces: [face("https://example.com/inter-other.woff2")] },
    ] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toEqual({ ok: false, reason: "font-dependency-conflict" });
    expect(original.resources?.fonts?.map((font) => font.family)).toEqual(["Inter"]);
  });

  it("rolls back materialized fonts when placement fails", () => {
    const original = presentation();
    const style = item({ type: "chart", properties: [] }, { fonts: [{ family: "Fira Code", faces: [face("https://example.com/fira.woff2")] }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toEqual({ ok: false, reason: "unsupported-create-type" });
    expect(original).toEqual(presentation());
  });
});
