import { isAbsoluteHttpHref, type ShapeElement } from "@web-slideshow/document-schema";

import { createElement } from "./element-operations";

const QR_SHAPE_SIZE = 240;
const QR_SHAPE_FILL = "#000000";

export function createQrShapeElement(
  href: string,
  usedIds: Set<string>,
): ShapeElement | null {
  if (!isAbsoluteHttpHref(href)) return null;

  const shape = createElement("shape", usedIds);
  if (shape.type !== "shape") return null;

  return {
    ...shape,
    geometry: {
      mode: "generated",
      generator: "qr-code",
      config: {
        value: href,
        errorCorrection: "M",
        quietZone: 4,
      },
    },
    layout: { width: QR_SHAPE_SIZE, height: QR_SHAPE_SIZE },
    style: { fill: { type: "color", color: QR_SHAPE_FILL } },
  };
}
