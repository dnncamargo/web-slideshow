import type { PowerShowElement } from "@powershow/document-schema";

import { findElementById } from "./element-tree";

export interface CanvasPointerSelection {
  id: string;
  type: string;
  documentElement: PowerShowElement;
}

export interface CanvasPointerTarget {
  id: string | undefined;
  type: string | undefined;
}

export function resolveCanvasPointerSelection(
  target: CanvasPointerTarget | null,
  elements: PowerShowElement[],
): CanvasPointerSelection | null {
  if (!target?.id || !target.type) {
    return null;
  }

  const documentElement = findElementById(elements, target.id);

  if (!documentElement) {
    return null;
  }

  return { id: target.id, type: target.type, documentElement };
}