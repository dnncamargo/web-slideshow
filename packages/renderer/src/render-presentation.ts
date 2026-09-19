import type {
  Presentation,
} from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderFontResources } from "./render-font-resources";
import { renderSlide } from "./render-slide";
import type { RenderContext } from "./render-element";
import {
  renderPresentationPaletteVariables,
} from "./render-palette";

export function renderPresentation(
  presentation: Presentation,
): string {
  const context: RenderContext = { presentation };
  const slides = presentation.slides
    .map((slide) => renderSlide(slide, context))
    .join("");
  const fontResources = renderFontResources(presentation.resources?.fonts);
  const fontResourceStyle = fontResources
    ? `<style data-presentation-font-resources>${fontResources}</style>`
    : "";
  const paletteVariables = renderPresentationPaletteVariables(
    presentation.palette,
  );
  const paletteStyle = paletteVariables
    ? ` style="${escapeHtml(paletteVariables)}"`
    : "";

  return (
    `<div` +
    ` class="presentation"` +
    paletteStyle +
    ` data-presentation-id="${escapeHtml(
      presentation.id,
    )}"` +
    ` data-presentation-schema-version="${presentation.schemaVersion}"` +
    ` data-presentation-aspect-ratio="${escapeHtml(
      presentation.aspectRatio,
    )}"` +
    `>` +
    fontResourceStyle +
    slides +
    `</div>`
  );
}
