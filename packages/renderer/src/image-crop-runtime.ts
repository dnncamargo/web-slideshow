import type { ImageElement } from "@powershow/document-schema";

import {
  resolveCroppedImageBoxSize,
  resolveImageCropGeometry,
} from "./image-crop";

type CroppedImageRoot = HTMLElement & {
  __powershowCropLoadListener?: EventListener;
};

function applyGeometry(root: CroppedImageRoot, image: HTMLImageElement): void {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) return;

  const crop = JSON.parse(root.dataset.powershowImageCrop ?? "null") as ImageElement["crop"];
  if (!crop) return;

  const widthAuthored = root.dataset.powershowImageWidthAuthored === "true";
  const heightAuthored = root.dataset.powershowImageHeightAuthored === "true";
  const box = root.getBoundingClientRect();
  const renderedWidth = root.clientWidth || box.width;
  const renderedHeight = root.clientHeight || box.height;
  const naturalCropWidth = sourceWidth * crop.width / 100;
  const naturalCropHeight = sourceHeight * crop.height / 100;
  const parent = root.parentElement;
  const parentRect = parent?.getBoundingClientRect();
  const availableWidth = parent
    ? parent.clientWidth || parentRect?.width
    : undefined;
  const availableHeight = parent
    ? parent.clientHeight || parentRect?.height
    : undefined;
  const size = resolveCroppedImageBoxSize({
    naturalCropWidth,
    naturalCropHeight,
    widthAuthored,
    heightAuthored,
    renderedWidth: widthAuthored ? renderedWidth : undefined,
    renderedHeight: heightAuthored ? renderedHeight : undefined,
    availableWidth: !widthAuthored && !heightAuthored ? availableWidth : undefined,
    availableHeight: !widthAuthored && !heightAuthored ? availableHeight : undefined,
  });
  if (!size) return;

  if (!widthAuthored) root.style.width = `${size.width}px`;
  if (!heightAuthored) root.style.height = `${size.height}px`;

  const geometry = resolveImageCropGeometry({
    sourceWidth,
    sourceHeight,
    boxWidth: size.width,
    boxHeight: size.height,
    crop,
    fit: (root.dataset.powershowImageFit ?? "contain") as ImageElement["fit"],
    focalPoint: {
      x: Number(root.dataset.powershowImageFocalX ?? 50),
      y: Number(root.dataset.powershowImageFocalY ?? 50),
    },
  });
  const viewport = root.querySelector<HTMLElement>(".powershow-image-crop-viewport");
  if (!viewport) return;
  const media = viewport.querySelector<HTMLImageElement>(".powershow-image-media");
  if (!media) return;

  viewport.style.width = `${geometry.viewportWidth}px`;
  viewport.style.height = `${geometry.viewportHeight}px`;
  viewport.style.left = `${geometry.viewportLeft}px`;
  viewport.style.top = `${geometry.viewportTop}px`;
  media.style.width = `${geometry.fullMediaWidth}px`;
  media.style.height = `${geometry.fullMediaHeight}px`;
  media.style.left = `${geometry.fullMediaLeft}px`;
  media.style.top = `${geometry.fullMediaTop}px`;
}

export function hydrateImageCrops(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-powershow-image-crop]").forEach((candidate) => {
    const imageRoot = candidate as CroppedImageRoot;
    const image = imageRoot.querySelector<HTMLImageElement>(".powershow-image-media");
    if (!image) return;

    const hydrate = () => applyGeometry(imageRoot, image);
    if (image.naturalWidth && image.naturalHeight) hydrate();
    if (!imageRoot.__powershowCropLoadListener) {
      imageRoot.__powershowCropLoadListener = hydrate;
      image.addEventListener("load", hydrate);
    }
  });
}
