import { hydrateContainerFits } from "./container-fit-runtime";
import { hydrateImageCrops } from "./image-crop-runtime";
import type { Slide } from "@powershow/document-schema";
import {
  disposePlotAnimations,
  getPlotAnimationController as getInternalPlotAnimationController,
  hydratePlotAnimations,
  type PlotAnimationController,
} from "./plot-animation-runtime";

export interface RendererRuntimeContext {
  plotAnimations?: {
    slide: Slide;
    autoplay?: boolean;
  };
}

export function hydrateRendererRuntime(root: ParentNode, context: RendererRuntimeContext = {}): void {
  hydrateImageCrops(root);
  hydrateContainerFits(root);
  if (context.plotAnimations === undefined) {
    disposePlotAnimations(root);
  } else {
    hydratePlotAnimations(root, context.plotAnimations.slide, context.plotAnimations.autoplay !== false);
  }
}

export function disposeRendererRuntime(root: ParentNode): void {
  disposePlotAnimations(root);
}

export type { PlotAnimationController };

export function getPlotAnimationController(
  root: ParentNode,
  elementId: string,
): PlotAnimationController | null {
  return getInternalPlotAnimationController(root, elementId);
}
