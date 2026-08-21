import type {
  GalleryElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

// ============================================================
// BEGIN: GALLERY CAROUSEL BEHAVIOR
//
// These are renderer-owned styles required for the Gallery
// minimum horizontal swipe/scroll carousel. They rely on native
// CSS scroll snapping and are not authored back into the
// document.
// ============================================================

const GALLERY_CAROUSEL_STYLES = [
  "display:flex",
  "overflow-x:auto",
  "overflow-y:hidden",
  "scroll-snap-type:x mandatory",
  "overscroll-behavior-inline:contain",
];

// Each Gallery item occupies one viewport/page of the
// carousel. flex-shrink is disabled and a 100% snap base is
// declared so the wrapper never shrinks below one Gallery page.
const GALLERY_ITEM_WRAPPER_STYLES = [
  "flex:0 0 100%",
  "scroll-snap-align:start",
  "min-width:100%",
];

const GALLERY_IMAGE_STYLES = [
  "display:block",
  "width:100%",
  "height:100%",
];

// ============================================================
// END: GALLERY CAROUSEL BEHAVIOR
// ============================================================

export function renderGallery(
  element: GalleryElement,
): string {
  if (element.hidden) {
    return "";
  }

  const classes = [
    "powershow-element",
    "powershow-gallery",
  ];

  const customClass =
    element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const styles: string[] = [];

  const baseStyle =
    renderStyle(element.style);

  if (baseStyle) {
    styles.push(baseStyle);
  }

  styles.push(...GALLERY_CAROUSEL_STYLES);

  const items = element.items
    .map((item) => {
      const imageStyles = [
        ...GALLERY_IMAGE_STYLES,
        `object-fit:${element.fit}`,
      ];

      return (
        `<div class="powershow-gallery-item"` +
        ` style="${escapeHtml(
          GALLERY_ITEM_WRAPPER_STYLES.join(";"),
        )}">` +
        `<img class="powershow-gallery-image"` +
        ` src="${escapeHtml(item.src)}"` +
        ` alt="${escapeHtml(item.alt)}"` +
        ` style="${escapeHtml(
          imageStyles.join(";"),
        )}">` +
        `</div>`
      );
    })
    .join("");

  return (
    `<div` +
    ` class="${escapeHtml(classes.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(
      element.id,
    )}"` +
    ` data-powershow-type="gallery"` +
    ` style="${escapeHtml(styles.join(";"))}"` +
    `>` +
    items +
    `</div>`
  );
}
