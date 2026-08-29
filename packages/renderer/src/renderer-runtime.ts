import { hydrateContainerFits } from "./container-fit-runtime";
import { hydrateImageCrops } from "./image-crop-runtime";

export function hydrateRendererRuntime(root: ParentNode): void {
  hydrateImageCrops(root);
  hydrateContainerFits(root);
}
