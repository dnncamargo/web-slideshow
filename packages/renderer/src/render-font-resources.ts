import {
  getFontResourceFaces,
  type FontFaceResource,
  type FontResource,
} from "@powershow/document-schema";

import {
  escapeCssDeclarationValue,
  quoteCssString,
} from "./escape-css-string";

function getFontFaceIdentity(
  family: string,
  face: FontFaceResource,
): string {
  return JSON.stringify([
    family.trim().toLowerCase(),
    face.weight ?? null,
    face.style ?? null,
    face.subset ?? null,
    face.source.url,
  ]);
}

function renderFontFace(family: string, face: FontFaceResource): string {
  const format = face.source.format
    ? ` format(${quoteCssString(face.source.format)})`
    : "";
  const weight =
    face.weight === undefined ? "" : `font-weight:${face.weight};`;
  const style = face.style === undefined ? "" : `font-style:${face.style};`;
  const unicodeRange =
    face.unicodeRange === undefined
      ? ""
      : `unicode-range:${escapeCssDeclarationValue(face.unicodeRange)};`;

  return (
    "@font-face{" +
    `font-family:${quoteCssString(family)};` +
    `src:url(${quoteCssString(face.source.url)})${format};` +
    weight +
    style +
    unicodeRange +
    "font-display:swap" +
    "}"
  );
}

export function renderFontResources(
  fonts: readonly FontResource[] | undefined,
): string {
  if (fonts === undefined) {
    return "";
  }

  const renderedFaces: string[] = [];
  const seenFaces = new Set<string>();

  for (const font of fonts) {
    for (const face of getFontResourceFaces(font)) {
      const identity = getFontFaceIdentity(font.family, face);

      if (seenFaces.has(identity)) {
        continue;
      }

      seenFaces.add(identity);
      renderedFaces.push(renderFontFace(font.family, face));
    }
  }

  return renderedFaces.join("");
}
