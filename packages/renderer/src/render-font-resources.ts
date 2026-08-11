import type { FontResource } from "@powershow/document-schema";

import { quoteCssString } from "./escape-css-string";

function renderFontResource(font: FontResource): string {
  const format = font.source.format
    ? ` format(${quoteCssString(font.source.format)})`
    : "";

  return (
    "@font-face{" +
    `font-family:${quoteCssString(font.family)};` +
    `src:url(${quoteCssString(font.source.url)})${format};` +
    "font-display:swap" +
    "}"
  );
}

export function renderFontResources(
  fonts: readonly FontResource[] | undefined,
): string {
  return fonts?.map(renderFontResource).join("") ?? "";
}
