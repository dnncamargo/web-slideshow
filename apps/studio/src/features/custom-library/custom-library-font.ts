import type { FontFaceResource } from "@web-slideshow/document-schema";

export type CustomLibraryFontFaceProvenance =
  | { kind: "managed-upload"; assetId: string }
  | { kind: "cdn"; provider: "fontsource" | "google-fonts" }
  | { kind: "external-url" };

export type CustomLibraryFontFace = FontFaceResource & {
  /** Absent only on records saved before source provenance was introduced. */
  provenance?: CustomLibraryFontFaceProvenance;
};

export interface CustomLibraryFontDraft {
  family: string;
  faces: CustomLibraryFontFace[];
}

export interface CustomLibraryFontRecord {
  id: string;
  font: CustomLibraryFontDraft;
}
