import type { GalleryElement } from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderImageCropMetadata } from "./render-canonical-image";
import { renderCanonicalSurfaceStyle } from "./render-canonical-surface";
import { renderGradientBorder } from "./render-visual";
import { renderLength } from "./render-length";

const GALLERY_ROOT_STYLES = ["position:relative", "overflow:hidden"];
const GALLERY_OVERLAY_ITEM_STYLES = [
  "position:absolute",
  "inset:0",
  "width:100%",
  "height:100%",
  "overflow:hidden",
];
const GALLERY_IMAGE_STYLES = [
  "display:block",
  "width:100%",
  "height:100%",
];

export function renderGallery(element: GalleryElement): string {
  if (element.hidden) return "";

  const gradientBorder = element.style?.border?.gradient;
  const hasGradientBorder = gradientBorder !== undefined;
  const classes = ["presentation-element", "presentation-gallery"];
  if (hasGradientBorder) {
    classes.push("presentation-gallery-gradient-frame", "presentation-gradient-border");
  }
  const customClass = element.style?.className?.trim();
  if (customClass) classes.push(customClass);

  const styles: string[] = [];
  const baseStyle = renderCanonicalSurfaceStyle(element, {
    includeBorder: !hasGradientBorder,
  });
  if (baseStyle) styles.push(baseStyle);
  if (hasGradientBorder && gradientBorder) {
    styles.push("border:0", ...renderGradientBorder(gradientBorder, element.style?.border?.width ?? 0));
    if (element.style?.borderRadius !== undefined) {
      styles.push(`--presentation-gallery-outer-radius:${renderLength(element.style.borderRadius)}`);
    }
  }
  if (element.layout?.position !== "absolute") {
    styles.push(...GALLERY_ROOT_STYLES);
  } else {
    styles.push("overflow:hidden");
  }

  const items = element.items.map((item, index) => {
    const isIntrinsicSizingItem = index === 0 && element.layout?.height === undefined;
    const effectiveFit = item.fit ?? element.fit;
    const imageStyles = [
      ...GALLERY_IMAGE_STYLES,
      `object-fit:${effectiveFit}`,
      `object-position:${item.focalPoint?.x ?? 50}% ${item.focalPoint?.y ?? 50}%`,
    ];
    const itemAttributes = [
      `class="presentation-gallery-item${index === 0 ? " presentation-gallery-item-active" : ""}"`,
      `data-presentation-gallery-index="${index}"`,
      `style="${escapeHtml((isIntrinsicSizingItem
        ? ["position:relative", "width:100%", "height:auto", "overflow:hidden"]
        : GALLERY_OVERLAY_ITEM_STYLES
      ).concat(index > 0 ? ["visibility:hidden", "pointer-events:none"] : []).join(";"))}"`,
    ];

    let image: string;
    if (item.crop) {
      itemAttributes.push(renderImageCropMetadata({
        crop: item.crop,
        fit: effectiveFit,
        ...(item.focalPoint ? { focalPoint: item.focalPoint } : {}),
        widthConstrained: true,
        heightConstrained: !isIntrinsicSizingItem,
      }));
      image = `<div class="presentation-image-crop-viewport" style="position:absolute"><img class="presentation-gallery-image presentation-image-media" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" style="display:block;position:absolute;max-width:none"></div>`;
    } else {
      const sizingImageStyles = isIntrinsicSizingItem
        ? [
          "display:block",
          "width:100%",
          "height:auto",
          `object-fit:${effectiveFit}`,
          `object-position:${item.focalPoint?.x ?? 50}% ${item.focalPoint?.y ?? 50}%`,
        ]
        : imageStyles;
      image = `<img class="presentation-gallery-image" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" style="${escapeHtml(sizingImageStyles.join(";"))}">`;
    }

    if (index > 0) itemAttributes.push('aria-hidden="true"');
    return `<div ${itemAttributes.join(" ")}>${image}</div>`;
  }).join("");

  const renderedItems = hasGradientBorder
    ? `<div class="presentation-gallery-gradient-surface${element.layout?.height !== undefined ? " presentation-gallery-gradient-surface-constrained" : ""}">${items}</div>`
    : items;

  return `<div class="${escapeHtml(classes.join(" "))}" data-presentation-id="${escapeHtml(element.id)}" data-presentation-type="gallery" style="${escapeHtml(styles.join(";"))}">${renderedItems}</div>`;
}
