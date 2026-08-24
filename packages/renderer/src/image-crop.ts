import type { ImageElement } from "@powershow/document-schema";

export type ImageCropGeometryInput = {
  sourceWidth: number;
  sourceHeight: number;
  boxWidth: number;
  boxHeight: number;
  crop: NonNullable<ImageElement["crop"]>;
  fit: ImageElement["fit"];
  focalPoint?: ImageElement["focalPoint"];
};

export type ImageCropGeometry = {
  cropSourceX: number;
  cropSourceY: number;
  cropSourceWidth: number;
  cropSourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  viewportLeft: number;
  viewportTop: number;
  fullMediaWidth: number;
  fullMediaHeight: number;
  fullMediaLeft: number;
  fullMediaTop: number;
};

export function resolveImageCropGeometry({
  sourceWidth,
  sourceHeight,
  boxWidth,
  boxHeight,
  crop,
  fit,
  focalPoint,
}: ImageCropGeometryInput): ImageCropGeometry {
  const cropSourceX = sourceWidth * crop.x / 100;
  const cropSourceY = sourceHeight * crop.y / 100;
  const cropSourceWidth = sourceWidth * crop.width / 100;
  const cropSourceHeight = sourceHeight * crop.height / 100;

  const scale = fit === "contain"
    ? Math.min(boxWidth / cropSourceWidth, boxHeight / cropSourceHeight)
    : Math.max(boxWidth / cropSourceWidth, boxHeight / cropSourceHeight);
  const scaleX = fit === "fill" ? boxWidth / cropSourceWidth : scale;
  const scaleY = fit === "fill" ? boxHeight / cropSourceHeight : scale;
  const viewportWidth = cropSourceWidth * scaleX;
  const viewportHeight = cropSourceHeight * scaleY;
  const focalX = (focalPoint?.x ?? 50) / 100;
  const focalY = (focalPoint?.y ?? 50) / 100;

  return {
    cropSourceX,
    cropSourceY,
    cropSourceWidth,
    cropSourceHeight,
    viewportWidth,
    viewportHeight,
    viewportLeft: (boxWidth - viewportWidth) * focalX,
    viewportTop: (boxHeight - viewportHeight) * focalY,
    fullMediaWidth: sourceWidth * scaleX,
    fullMediaHeight: sourceHeight * scaleY,
    fullMediaLeft: -cropSourceX * scaleX,
    fullMediaTop: -cropSourceY * scaleY,
  };
}
