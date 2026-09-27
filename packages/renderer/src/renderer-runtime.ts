import { hydrateContainerFits } from "./container-fit-runtime";
import { hydrateCheckboxes, type CheckboxRuntimeOptions } from "./checkbox-runtime";
import { hydrateImageCrops } from "./image-crop-runtime";
import type { Slide } from "@web-slideshow/document-schema";
import {
  disposePlotAnimations,
  getPlotAnimationController as getInternalPlotAnimationController,
  hydratePlotAnimations,
  type PlotAnimationController,
} from "./plot-animation-runtime";
import {
  disposeShapeAnimations,
  getShapeAnimationController as getInternalShapeAnimationController,
  hydrateShapeAnimations,
  type ShapeAnimationController,
} from "./shape-animation-runtime";

export interface RendererRuntimeContext {
  checkboxes?: CheckboxRuntimeOptions;
  plotAnimations?: {
    slide: Slide;
    autoplay?: boolean;
  };
  shapeAnimations?: {
    slide: Slide;
    autoplay?: boolean;
  };
}

export function hydrateRendererRuntime(root: ParentNode, context: RendererRuntimeContext = {}): void {
  hydrateCheckboxes(root, context.checkboxes);
  hydrateImageCrops(root);
  hydrateContainerFits(root);
  if (context.plotAnimations === undefined) {
    disposePlotAnimations(root);
  } else {
    hydratePlotAnimations(root, context.plotAnimations.slide, context.plotAnimations.autoplay !== false);
  }
  if (context.shapeAnimations === undefined) {
    disposeShapeAnimations(root);
  } else {
    hydrateShapeAnimations(root, context.shapeAnimations.slide, context.shapeAnimations.autoplay !== false);
  }
}

export function disposeRendererRuntime(root: ParentNode): void {
  disposePlotAnimations(root);
  disposeShapeAnimations(root);
}

export type { PlotAnimationController, ShapeAnimationController };

export function getPlotAnimationController(
  root: ParentNode,
  elementId: string,
): PlotAnimationController | null {
  return getInternalPlotAnimationController(root, elementId);
}

export function getShapeAnimationController(
  root: ParentNode,
  elementId: string,
): ShapeAnimationController | null {
  return getInternalShapeAnimationController(root, elementId);
}
