import type { ImageElement } from "@powershow/document-schema";

import { resolveImageCropGeometry } from "./image-crop";

type CroppedImageRoot = HTMLElement & {
  __powershowCropLoadListener?: EventListener;
};

function applyGeometry(root: CroppedImageRoot, image: HTMLImageElement): void {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) return;

  const crop = JSON.parse(root.dataset.powershowImageCrop ?? "null") as ImageElement["crop"];
  if (!crop) return;

  const box = root.getBoundingClientRect();
  const croppedAspect = (sourceWidth * crop.width) / (sourceHeight * crop.height);
  // clientWidth/clientHeight represent the content box and avoid including
  // authored borders in the crop geometry. The rect fallback keeps the
  // helper usable with lightweight DOM implementations and test doubles.
  let boxWidth = root.clientWidth || box.width;
  let boxHeight = root.clientHeight || box.height;

  if (!boxWidth && root.dataset.powershowImageWidthAuthored !== "true") {
    boxWidth = boxHeight ? boxHeight * croppedAspect : sourceWidth * crop.width / 100;
  }
  if (!boxHeight && root.dataset.powershowImageHeightAuthored !== "true") {
    boxHeight = boxWidth ? boxWidth / croppedAspect : sourceHeight * crop.height / 100;
  }
  if (!boxWidth || !boxHeight) return;

  if (root.dataset.powershowImageWidthAuthored !== "true" && !box.width) {
    root.style.width = `${boxWidth}px`;
  }
  if (root.dataset.powershowImageHeightAuthored !== "true" && !box.height) {
    root.style.height = `${boxHeight}px`;
  }

  const geometry = resolveImageCropGeometry({
    sourceWidth,
    sourceHeight,
    boxWidth,
    boxHeight,
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
