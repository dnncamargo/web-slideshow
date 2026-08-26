import type {
  Presentation,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderFontResources } from "./render-font-resources";
import { renderSlide } from "./render-slide";
import {
  renderPresentationPaletteVariables,
} from "./render-palette";

export function renderPresentation(
  presentation: Presentation,
): string {
  const slides = presentation.slides
    .map(renderSlide)
    .join("");
  const fontResources = renderFontResources(presentation.resources?.fonts);
  const fontResourceStyle = fontResources
    ? `<style data-powershow-font-resources>${fontResources}</style>`
    : "";
  const paletteVariables = renderPresentationPaletteVariables(
    presentation.palette,
  );
  const paletteStyle = paletteVariables
    ? ` style="${escapeHtml(paletteVariables)}"`
    : "";

  return (
    `<div` +
    ` class="powershow-presentation"` +
    paletteStyle +
    ` data-powershow-presentation-id="${escapeHtml(
      presentation.id,
    )}"` +
    ` data-powershow-schema-version="${presentation.schemaVersion}"` +
    ` data-powershow-aspect-ratio="${escapeHtml(
      presentation.aspectRatio,
    )}"` +
    `>` +
    fontResourceStyle +
    slides +
    `</div>`
  );
}
