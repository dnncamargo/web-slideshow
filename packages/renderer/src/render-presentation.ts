import type {
  Presentation,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderSlide } from "./render-slide";

export function renderPresentation(
  presentation: Presentation,
): string {
  const slides = presentation.slides
    .map(renderSlide)
    .join("");

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
    slides +
    `</div>`
  );
}