import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

import { isAbsoluteHttpHref } from "@powershow/document-schema";
import type { ImageElement, Slide } from "@powershow/document-schema";

import { createElement } from "./element-operations";

export function createQrImageElement(
  href: string,
  slides: readonly Slide[],
): ImageElement | null {
  if (!isAbsoluteHttpHref(href)) {
    return null;
  }

  const image = createElement("image", slides);
  if (image.type !== "image") {
    return null;
  }

  const svg = renderToStaticMarkup(
    <QRCodeSVG value={href} level="M" includeMargin />,
  );
  const standaloneSvg = svg.replace(
    /^<svg\b/,
    '<svg xmlns="http://www.w3.org/2000/svg"',
  );
  const accessibleSvg = standaloneSvg.replace(
    /^(<svg\b[^>]*>)/,
    `$1<title>QR code for ${escapeXml(href)}</title>`,
  );

  return {
    ...image,
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(accessibleSvg)}`,
    alt: `QR code for ${href}`,
  };
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default: return character;
    }
  });
}
