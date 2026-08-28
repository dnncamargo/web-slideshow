import type {
  Slide,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderElement, type RenderContext } from "./render-element";
import {
  renderSlideBackground,
} from "./render-slide-background";

export function renderSlide(
  slide: Slide,
  context?: RenderContext,
): string {
  const content = slide.elements
    .map((element) => renderElement(element, context))
    .join("");

  const background =
    renderSlideBackground(
      slide.background,
    );

  return (
    `<section` +
    ` class="powershow-slide"` +
    ` data-powershow-slide-id="${escapeHtml(
      slide.id,
    )}"` +
    ` style="position:relative;overflow:hidden;width:100%;height:100%"` +
    `>` +
    background +
    `<div` +
    ` class="powershow-slide-content"` +
    ` style="position:relative;z-index:1;width:100%;height:100%"` +
    `>` +
    content +
    `</div>` +
    `</section>`
  );
}
