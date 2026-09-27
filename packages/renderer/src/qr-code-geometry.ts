import type { ShapeQrCodeConfig } from "@web-slideshow/document-schema";
import QRCode from "qrcode";

export interface QrCodeGeometry {
  readonly size: number;
  readonly modules: readonly (readonly boolean[])[];
}

const ERROR_CORRECTION_LEVELS = {
  L: "L",
  M: "M",
  Q: "Q",
  H: "H",
} as const;

export function createQrCodeGeometry(config: ShapeQrCodeConfig): QrCodeGeometry {
  const qr = QRCode.create(config.value, {
    errorCorrectionLevel: ERROR_CORRECTION_LEVELS[config.errorCorrection],
  });
  const size = qr.modules.size;

  return {
    size,
    modules: Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, column) => qr.modules.get(row, column) === 1)),
  };
}
