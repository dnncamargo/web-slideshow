import type { GalleryElement } from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderCanonicalImageCropMetadata } from "./render-canonical-image";
import { renderCanonicalSurfaceStyle } from "./render-canonical-surface";

const GALLERY_ROOT_STYLES = ["position:relative", "overflow:hidden"];
const GALLERY_ITEM_STYLES = [
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

  const classes = ["powershow-element", "powershow-gallery"];
  const customClass = element.style?.className?.trim();
  if (customClass) classes.push(customClass);

  const styles: string[] = [];
  const baseStyle = renderCanonicalSurfaceStyle(element);
  if (baseStyle) styles.push(baseStyle);
  if (element.layout?.position !== "absolute") {
    styles.push(...GALLERY_ROOT_STYLES);
  } else {
    styles.push("overflow:hidden");
  }

  const items = element.items.map((item, index) => {
    const effectiveFit = item.fit ?? element.fit;
    const imageStyles = [
      ...GALLERY_IMAGE_STYLES,
      `object-fit:${effectiveFit}`,
      `object-position:${item.focalPoint?.x ?? 50}% ${item.focalPoint?.y ?? 50}%`,
    ];
    const itemAttributes = [
      `class="powershow-gallery-item${index === 0 ? " powershow-gallery-item-active" : ""}"`,
      `data-powershow-gallery-index="${index}"`,
      `style="${escapeHtml([...GALLERY_ITEM_STYLES, ...(index > 0 ? ["visibility:hidden", "pointer-events:none"] : [])].join(";"))}"`,
    ];

    let image: string;
    if (item.crop) {
      itemAttributes.push(renderCanonicalImageCropMetadata({
        crop: item.crop,
        fit: effectiveFit,
        ...(item.focalPoint ? { focalPoint: item.focalPoint } : {}),
        ...(element.layout ? { layout: element.layout } : {}),
      }));
      image = `<div class="powershow-image-crop-viewport"><img class="powershow-gallery-image powershow-image-media" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" style="display:block;position:absolute;max-width:none"></div>`;
    } else {
      image = `<img class="powershow-gallery-image" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" style="${escapeHtml(imageStyles.join(";"))}">`;
    }

    if (index > 0) itemAttributes.push('aria-hidden="true"');
    return `<div ${itemAttributes.join(" ")}>${image}</div>`;
  }).join("");

  return `<div class="${escapeHtml(classes.join(" "))}" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="gallery" style="${escapeHtml(styles.join(";"))}">${items}</div>`;
}
