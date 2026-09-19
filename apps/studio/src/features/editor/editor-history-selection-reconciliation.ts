import type { Presentation } from "@powershow/document-schema";

import { findElementById } from "./element-tree";

export interface ReplaySelectedElement {
  readonly id: string;
  readonly type: string;
  readonly contentSlotId?: string | null;
}

export function reconcileSelectedElementAfterReplay(
  selected: ReplaySelectedElement | null,
  presentation: Presentation,
  slideIndex: number,
): ReplaySelectedElement | null {
  if (!selected) return null;
  const slide = presentation.slides[slideIndex];
  return slide && findElementById(slide.elements, selected.id)
    ? { ...selected, contentSlotId: null }
    : null;
}
