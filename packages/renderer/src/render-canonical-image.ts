import type { ImageElement } from "@powershow/document-schema";

import { renderLength } from "./render-length";
import { renderBorder, renderShadow } from "./render-visual";
import { escapeHtml } from "./escape-html";

function renderImageLayout(element: ImageElement): string[] {
  const layout = element.layout;
  if (!layout) return [];

  const output: string[] = [];
  for (const [property, value] of [
    ["width", layout.width],
    ["height", layout.height],
    ["position", layout.position],
    ["top", layout.top],
    ["right", layout.right],
    ["bottom", layout.bottom],
    ["left", layout.left],
  ] as const) {
    if (value !== undefined) {
      output.push(`${property}:${property === "position" ? value : renderLength(value)}`);
    }
  }
  return output;
}

export function renderCanonicalImageStyle(element: ImageElement): string {
  const output = renderImageLayout(element);
  const style = element.style;
  const effect = element.effect;

  if (style?.border) output.push(...renderBorder(style.border));
  if (style?.borderRadius !== undefined) {
    output.push(`border-radius:${renderLength(style.borderRadius)}`);
  }
  if (effect?.opacity !== undefined) output.push(`opacity:${effect.opacity}`);
  if (effect?.shadow) output.push(`box-shadow:${renderShadow(effect.shadow)}`);

  return output.join(";");
}

export function renderCanonicalImageMediaStyle(element: ImageElement): string {
  const output = [
    "display:block",
    `object-fit:${element.fit}`,
    `object-position:${element.focalPoint?.x ?? 50}% ${element.focalPoint?.y ?? 50}%`,
  ];

  if (element.layout?.width !== undefined) output.push("width:100%");
  if (element.layout?.height !== undefined) output.push("height:100%");
  if (element.style?.borderRadius !== undefined) {
    output.push(`border-radius:${renderLength(element.style.borderRadius)}`);
  }

  return output.join(";");
}

export function renderCanonicalImageCropMetadata(element: ImageElement): string {
  if (!element.crop) return "";

  return [
    `data-powershow-image-crop="${escapeHtml(JSON.stringify(element.crop))}"`,
    `data-powershow-image-fit="${element.fit}"`,
    `data-powershow-image-focal-x="${element.focalPoint?.x ?? 50}"`,
    `data-powershow-image-focal-y="${element.focalPoint?.y ?? 50}"`,
    `data-powershow-image-width-authored="${element.layout?.width !== undefined}"`,
    `data-powershow-image-height-authored="${element.layout?.height !== undefined}"`,
  ].join(" ");
}
