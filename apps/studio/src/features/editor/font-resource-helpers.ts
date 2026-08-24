import type {
  FontFaceResource,
  Presentation,
} from "@powershow/document-schema";

import { someElement } from "./element-tree";

export function normalizeFontFamily(family: string): string {
  return family.trim().toLowerCase();
}

export function createFontResourceId(
  family: string,
  existingIds: readonly string[],
): string {
  const baseId =
    family
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "font";
  const usedIds = new Set(existingIds);

  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

export function areFontFacesEquivalent(
  first: FontFaceResource,
  second: FontFaceResource,
): boolean {
  return (
    first.weight === second.weight &&
    first.style === second.style &&
    first.subset === second.subset &&
    first.unicodeRange === second.unicodeRange &&
    first.source.url === second.source.url
  );
}

export function presentationUsesFontFamily(
  presentation: Presentation,
  family: string,
): boolean {
  const normalizedFamily = normalizeFontFamily(family);

  return presentation.slides.some((slide) =>
    someElement(slide.elements, (element) => {
      let fontFamily: string | undefined;
      if (element.type === "container" || element.type === "text" || element.type === "textbox" || element.type === "topics") {
        fontFamily = element.typography?.fontFamily;
      }

      return (
        fontFamily !== undefined &&
        normalizeFontFamily(fontFamily) === normalizedFamily
      );
    }),
  );
}
