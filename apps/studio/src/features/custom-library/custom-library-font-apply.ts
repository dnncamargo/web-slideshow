import {
  FontResourceSchema,
  getFontResourceFaces,
  type FontFaceResource,
  type Presentation,
} from "@powershow/document-schema";

import {
  areFontFacesEquivalent,
  createFontResourceId,
  normalizeFontFamily,
} from "@/features/editor/font-resource-helpers";

import type { CustomLibraryFontDraft } from "./custom-library-font";

export type CustomLibraryFontApplyResult =
  | { kind: "added"; presentation: Presentation; fontResourceId: string; addedFaces: number }
  | { kind: "merged"; presentation: Presentation; fontResourceId: string; addedFaces: number }
  | { kind: "unchanged"; presentation: Presentation; fontResourceId: string; addedFaces: 0 }
  | { kind: "conflict"; presentation: Presentation };

function sameFaceSlot(first: FontFaceResource, second: FontFaceResource): boolean {
  return first.weight === second.weight &&
    first.style === second.style &&
    first.subset === second.subset &&
    first.unicodeRange === second.unicodeRange;
}

function findFaceInSlot(faces: readonly FontFaceResource[], slot: FontFaceResource): FontFaceResource | undefined {
  return faces.find((face) => sameFaceSlot(face, slot));
}

export function addCustomLibraryFontToPresentation(
  presentation: Presentation,
  libraryFont: CustomLibraryFontDraft,
): CustomLibraryFontApplyResult {
  const currentFonts = presentation.resources?.fonts ?? [];
  const existingResourceIndex = currentFonts.findIndex(
    (fontResource) => normalizeFontFamily(fontResource.family) === normalizeFontFamily(libraryFont.family),
  );

  const incomingFaces: FontFaceResource[] = [];
  for (const incomingFace of libraryFont.faces) {
    const duplicate = findFaceInSlot(incomingFaces, incomingFace);
    if (duplicate) {
      if (!areFontFacesEquivalent(duplicate, incomingFace)) {
        return { kind: "conflict", presentation };
      }
      continue;
    }
    incomingFaces.push(incomingFace);
  }

  if (existingResourceIndex === -1) {
    const fontResource = FontResourceSchema.safeParse({
      id: createFontResourceId(
        libraryFont.family,
        currentFonts.map((resource) => resource.id),
      ),
      family: libraryFont.family,
      faces: incomingFaces,
    });
    if (!fontResource.success) {
      return { kind: "conflict", presentation };
    }
    return {
      kind: "added",
      presentation: {
        ...presentation,
        resources: {
          ...presentation.resources,
          fonts: [...currentFonts, fontResource.data],
        },
      },
      fontResourceId: fontResource.data.id,
      addedFaces: incomingFaces.length,
    };
  }

  const existingResource = currentFonts[existingResourceIndex];
  if (!existingResource) return { kind: "conflict", presentation };
  const existingFaces = getFontResourceFaces(existingResource);
  const missingFaces: FontFaceResource[] = [];

  for (const incomingFace of incomingFaces) {
    const localFacesInSlot = existingFaces.filter((face) => sameFaceSlot(face, incomingFace));
    if (localFacesInSlot.length > 0) {
      if (localFacesInSlot.some((localFace) => !areFontFacesEquivalent(localFace, incomingFace))) {
        return { kind: "conflict", presentation };
      }
    } else {
      missingFaces.push(incomingFace);
    }
  }

  if (missingFaces.length === 0) {
    return {
      kind: "unchanged",
      presentation,
      fontResourceId: existingResource.id,
      addedFaces: 0,
    };
  }

  const updatedResource = FontResourceSchema.safeParse({
    id: existingResource.id,
    family: existingResource.family,
    faces: [...existingFaces, ...missingFaces],
  });
  if (!updatedResource.success) return { kind: "conflict", presentation };

  return {
    kind: "merged",
    presentation: {
      ...presentation,
      resources: {
        ...presentation.resources,
        fonts: currentFonts.map((resource, index) =>
          index === existingResourceIndex ? updatedResource.data : resource,
        ),
      },
    },
    fontResourceId: existingResource.id,
    addedFaces: missingFaces.length,
  };
}
