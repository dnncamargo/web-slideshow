import type { FontFaceResource } from "@web-slideshow/document-schema";

export interface CustomLibraryFontDraft {
  family: string;
  faces: FontFaceResource[];
}

export interface CustomLibraryFontRecord {
  id: string;
  font: CustomLibraryFontDraft;
}
