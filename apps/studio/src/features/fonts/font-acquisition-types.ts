import type { FontFaceResource } from "@web-slideshow/document-schema";

export interface FontFamilyFaces {
  family: string;
  faces: readonly FontFaceResource[];
}

export type OnAddFontFace = (
  family: string,
  face: FontFaceResource,
) => boolean | Promise<boolean>;
