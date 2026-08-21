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

export interface CanvasPointerPosition {
  clientX: number;
  clientY: number;
}

export interface CanvasEmbedHitTarget {
  id: string;
  type: "embed";
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Resolve a pointer over a Studio-neutralized Embed before DOM bubbling can
 * fall back to an enclosing selectable element such as a Container.
 *
 * Targets are checked in DOM order so the last matching target is treated as
 * the topmost one when authored elements overlap.
 */
export function resolveCanvasEmbedPointerTarget(
  position: CanvasPointerPosition,
  targets: readonly CanvasEmbedHitTarget[],
): CanvasPointerTarget | null {
  let hit: CanvasPointerTarget | null = null;

  for (const target of targets) {
    if (
      position.clientX >= target.left &&
      position.clientX <= target.right &&
      position.clientY >= target.top &&
      position.clientY <= target.bottom
    ) {
      hit = { id: target.id, type: target.type };
    }
  }

  return hit;
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
