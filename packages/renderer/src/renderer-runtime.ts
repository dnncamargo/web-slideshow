import { hydrateContainerFits } from "./container-fit-runtime";
import { hydrateImageCrops } from "./image-crop-runtime";
import type { Slide } from "@powershow/document-schema";
import { disposePlotAnimations, hydratePlotAnimations } from "./plot-animation-runtime";

export interface RendererRuntimeContext {
  plotAnimations?: {
    slide: Slide;
  };
}

export function hydrateRendererRuntime(root: ParentNode, context: RendererRuntimeContext = {}): void {
  hydrateImageCrops(root);
  hydrateContainerFits(root);
  if (context.plotAnimations === undefined) {
    disposePlotAnimations(root);
  } else {
    hydratePlotAnimations(root, context.plotAnimations.slide);
  }
}

export function disposeRendererRuntime(root: ParentNode): void {
  disposePlotAnimations(root);
}
