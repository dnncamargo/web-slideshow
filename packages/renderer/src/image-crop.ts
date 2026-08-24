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

export type CroppedImageBoxSizeInput = {
  naturalCropWidth: number;
  naturalCropHeight: number;
  widthAuthored: boolean;
  heightAuthored: boolean;
  renderedWidth?: number | undefined;
  renderedHeight?: number | undefined;
  availableWidth?: number | undefined;
  availableHeight?: number | undefined;
};

export type CroppedImageBoxSize = {
  width: number;
  height: number;
};

export function resolveCroppedImageBoxSize({
  naturalCropWidth,
  naturalCropHeight,
  widthAuthored,
  heightAuthored,
  renderedWidth,
  renderedHeight,
  availableWidth,
  availableHeight,
}: CroppedImageBoxSizeInput): CroppedImageBoxSize | null {
  const croppedAspect = naturalCropWidth / naturalCropHeight;

  if (widthAuthored && heightAuthored) {
    if (!renderedWidth || !renderedHeight) return null;
    return { width: renderedWidth, height: renderedHeight };
  }

  if (widthAuthored) {
    if (!renderedWidth) return null;
    return { width: renderedWidth, height: renderedWidth / croppedAspect };
  }

  if (heightAuthored) {
    if (!renderedHeight) return null;
    return { width: renderedHeight * croppedAspect, height: renderedHeight };
  }

  const scales = [1];
  if (availableWidth && availableWidth > 0) {
    scales.push(availableWidth / naturalCropWidth);
  }
  if (availableHeight && availableHeight > 0) {
    scales.push(availableHeight / naturalCropHeight);
  }
  const scale = Math.min(...scales);

  return {
    width: naturalCropWidth * scale,
    height: naturalCropHeight * scale,
  };
}

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
