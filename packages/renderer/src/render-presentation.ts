import type {
  Presentation,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderFontResources } from "./render-font-resources";
import { renderSlide } from "./render-slide";

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

  return (
    `<div` +
    ` class="powershow-presentation"` +
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
