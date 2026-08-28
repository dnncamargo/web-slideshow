import type { Presentation } from "@powershow/document-schema";

export {
  areFontFacesEquivalent,
  normalizeFontFamily,
} from "@/features/fonts/font-face-helpers";
import { normalizeFontFamily } from "@/features/fonts/font-face-helpers";
import { someElement } from "./element-tree";

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

export function presentationUsesFontFamily(
  presentation: Presentation,
  family: string,
): boolean {
  const normalizedFamily = normalizeFontFamily(family);

  return presentation.slides.some((slide) =>
    someElement(slide.elements, (element) => {
      let fontFamily: string | undefined;
      if (element.type === "container" || element.type === "text" || element.type === "topics") {
        fontFamily = element.typography?.fontFamily;
      }

      return (
        fontFamily !== undefined &&
        normalizeFontFamily(fontFamily) === normalizedFamily
      );
    }) || (presentation.typographyStyles ?? []).some((style) =>
      style.typography.fontFamily !== undefined &&
      normalizeFontFamily(style.typography.fontFamily) === normalizedFamily,
    ),
  );
}
