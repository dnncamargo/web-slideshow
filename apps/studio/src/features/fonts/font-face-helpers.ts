import type { FontFaceResource } from "@powershow/document-schema";

export function normalizeFontFamily(family: string): string {
  return family.trim().toLowerCase();
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
