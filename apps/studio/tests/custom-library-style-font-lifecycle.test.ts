import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type FontResource,
  type Presentation,
  type PowerShowElement,
} from "@powershow/document-schema";
import { renderFontResources, renderPresentation } from "@powershow/renderer";

import {
  createCustomLibraryItemDraft,
} from "../src/features/custom-library/custom-library-item";
import { applyCustomLibraryItemToPresentation } from "../src/features/custom-library/custom-library-item-apply";
import type { CustomLibraryFontDraft } from "../src/features/custom-library/custom-library-font";
import { parseCustomLibraryItemDraft } from "../src/features/custom-library/custom-library-schema";

const sourceFont: FontResource = {
  id: "fira-source",
  family: "Fira Code",
  faces: [{
    weight: 400,
    style: "normal",
    source: {
      type: "url",
      url: "https://example.com/fira-v1.woff2",
      format: "woff2",
    },
  }],
};

function presentation(
  id: string,
  elements: PowerShowElement[] = [],
  fonts?: FontResource[],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id,
    title: id,
    slides: [{ id: `${id}-slide`, elements }],
    ...(fonts === undefined ? {} : { resources: { fonts } }),
  });
}

function sourceComposition(): PowerShowElement {
  return {
    type: "container",
    id: "source-container",
    hidden: false,
    children: [{
      type: "text",
      id: "source-text",
      hidden: false,
      content: "Independent style",
      variant: "body",
      typography: { fontFamily: "Fira Code" },
    }],
  };
}

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function recipeSelections(): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map([
    ["source-container", new Set<string>()],
    ["source-text", new Set(["content", "typography.fontFamily"])],
  ]);
}

function appliedText(value: Presentation): Extract<PowerShowElement, { type: "text" }> {
  const container = value.slides[0]?.elements[0];
  if (!container || container.type !== "container") {
    throw new Error("Expected the applied container.");
  }
  const text = container.children[0];
  if (!text || text.type !== "text") {
    throw new Error("Expected the applied text.");
  }
  return text;
}

function serializedMasterIdentityFree(value: Presentation): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("library-font-master");
  expect(serialized).not.toContain("library-style-master");
  expect(serialized).not.toMatch(/(?:libraryStyleId|fontMasterId|customLibraryId|provenance|dependencyId|binding)/i);
}

describe("Custom Library Style font dependency lifecycle", () => {
  it("keeps source and destination presentations independent of deleted masters", () => {
    const presentationA = presentation("presentation-a", [sourceComposition()], [sourceFont]);
    const presentationASnapshot = structuredClone(presentationA);
    expect(PresentationSchema.parse(jsonRoundTrip(presentationA))).toEqual(presentationA);

    const styleDraft = createCustomLibraryItemDraft({
      name: "Fira Style",
      root: presentationA.slides[0]!.elements[0]!,
      selections: recipeSelections(),
      fontResources: presentationA.resources?.fonts,
    });

    expect(styleDraft.root.children).toHaveLength(1);
    expect(styleDraft.dependencies?.fonts).toEqual([{
      family: "Fira Code",
      faces: sourceFont.faces,
    }]);
    expect(JSON.stringify(styleDraft)).not.toContain("fira-source");
    expect(JSON.stringify(styleDraft)).not.toContain("presentation-a");
    expect(styleDraft.dependencies?.fonts?.[0]).not.toHaveProperty("id");

    const styleReloaded = parseCustomLibraryItemDraft(jsonRoundTrip(styleDraft));
    expect(styleReloaded).toEqual(styleDraft);

    let fontMaster: { id: string; font: CustomLibraryFontDraft } | undefined = {
      id: "library-font-master",
      font: styleReloaded.dependencies!.fonts![0]!,
    };
    expect(fontMaster.font.faces[0]!.source.url).toBe("https://example.com/fira-v1.woff2");
    fontMaster = {
      id: "library-font-master",
      font: { family: "Fira Code", faces: [{
        weight: 400,
        style: "normal",
        source: { type: "url", url: "https://example.com/fira-v2.woff2", format: "woff2" },
      }] },
    };
    expect(fontMaster.font.faces[0]!.source.url).toBe("https://example.com/fira-v2.woff2");
    fontMaster = undefined;
    expect(fontMaster).toBeUndefined();

    const presentationB = presentation("presentation-b");
    const applied = applyCustomLibraryItemToPresentation(styleReloaded, presentationB, 0, null);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.presentation.resources?.fonts).toHaveLength(1);
    expect(applied.presentation.resources?.fonts?.[0]).toMatchObject({
      family: "Fira Code",
      faces: sourceFont.faces,
    });
    expect(applied.presentation.resources?.fonts?.[0]?.id).not.toBe("fira-source");
    expect(appliedText(applied.presentation)).toMatchObject({
      content: "Independent style",
      typography: { fontFamily: "Fira Code" },
    });
    expect(JSON.stringify(applied.presentation)).not.toContain("fira-v2.woff2");
    serializedMasterIdentityFree(applied.presentation);

    const persistedB = PresentationSchema.parse(jsonRoundTrip(applied.presentation));
    expect(persistedB.schemaVersion).toBe(1);
    expect(PresentationSchema.parse(jsonRoundTrip(presentationA))).toEqual(presentationASnapshot);

    const renderedB = renderPresentation(persistedB);
    const renderedFonts = renderFontResources(persistedB.resources?.fonts ?? []);
    expect(renderedB).toContain("Independent style");
    expect(renderedB).toContain("Fira Code");
    expect(renderedFonts).toContain("Fira Code");
    expect(renderedFonts).toContain("https://example.com/fira-v1.woff2");
    expect(renderedFonts).not.toContain("https://example.com/fira-v2.woff2");

    const savedStyleSnapshot = structuredClone(styleReloaded);
    styleReloaded.dependencies!.fonts![0]!.faces[0]!.source.url = "https://example.com/changed-after-apply.woff2";
    expect(persistedB.resources?.fonts?.[0]?.faces?.[0]?.source.url).toBe("https://example.com/fira-v1.woff2");
    expect(savedStyleSnapshot.dependencies?.fonts?.[0]?.faces?.[0]?.source.url).toBe("https://example.com/fira-v1.woff2");

    const styleMaster: unknown = undefined;
    expect(styleMaster).toBeUndefined();
    expect(PresentationSchema.parse(jsonRoundTrip(persistedB))).toEqual(persistedB);
    expect(renderPresentation(persistedB)).toContain("Independent style");
    expect(renderFontResources(persistedB.resources?.fonts ?? [])).toContain("fira-v1.woff2");
    expect(PresentationSchema.parse(jsonRoundTrip(presentationA))).toEqual(presentationASnapshot);
  });
});
