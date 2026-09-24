import type { Presentation } from "@web-slideshow/document-schema";
import { materializeSlide } from "@web-slideshow/document-schema";

import {
  resolveAuthoringElements,
  type AuthoringTarget,
} from "./authoring-target";
import { findElementById } from "./element-tree";

export interface ReplaySelectedElement {
  readonly id: string;
  readonly type: string;
  readonly contentSlotId?: string | null;
}

export function reconcileSelectedElementAfterReplay(
  selected: ReplaySelectedElement | null,
  presentation: Presentation,
  targetOrSlideIndex: AuthoringTarget | number,
): ReplaySelectedElement | null {
  if (!selected) return null;
  const target: AuthoringTarget = typeof targetOrSlideIndex === "number"
    ? { kind: "slide", slideIndex: targetOrSlideIndex }
    : targetOrSlideIndex;
  const elements = target.kind === "slide"
    ? (() => {
        const slide = presentation.slides[target.slideIndex];
        return slide ? materializeSlide(presentation, slide).slide.elements : null;
      })()
    : resolveAuthoringElements(presentation, target);
  return elements && findElementById(elements, selected.id)
    ? { ...selected, contentSlotId: null }
    : null;
}
