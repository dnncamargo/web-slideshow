import type { FontFaceResource } from "@web-slideshow/document-schema";
import type { CustomLibraryFontFaceProvenance } from "../custom-library/custom-library-font";

export interface FontFamilyFaces {
  family: string;
  faces: readonly FontFaceResource[];
}

export type FontFaceAddResult =
  | boolean
  | { status: "saved" | "duplicate" | "persistence-failed" };

export type OnAddFontFace = (
  family: string,
  face: FontFaceResource,
  persistenceId?: string,
  provenance?: CustomLibraryFontFaceProvenance,
) => FontFaceAddResult | Promise<FontFaceAddResult>;

export function fontFaceWasSaved(result: FontFaceAddResult): boolean {
  return result === true || (typeof result === "object" && result.status === "saved");
}

export function fontFacePersistenceFailed(result: FontFaceAddResult): boolean {
  return typeof result === "object" && result.status === "persistence-failed";
}
