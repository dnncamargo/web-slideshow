import type { FontFaceResource } from "@powershow/document-schema";

export interface CustomLibraryFontDraft {
  family: string;
  faces: FontFaceResource[];
}

export interface CustomLibraryFontRecord {
  id: string;
  font: CustomLibraryFontDraft;
}
