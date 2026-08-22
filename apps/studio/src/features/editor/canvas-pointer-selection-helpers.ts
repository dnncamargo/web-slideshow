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

export interface CanvasPointerHit {
  elementTarget: HTMLElement | null;
  target: CanvasPointerTarget | null;
}

/**
 * Resolve the final pointer hit once both the ordinary authored DOM target
 * and the geometrically-hit Embed are known.
 *
 * A geometrically-hit Embed may override the ordinary DOM target only when:
 *   - there is no ordinary authored target; or
 *   - the ordinary authored target contains the Embed DOM element, such as a
 *     Container that holds the Embed.
 *
 * An unrelated or overlapping authored element is never preempted merely
 * because its coordinates also fall inside an Embed rectangle.
 *
 * When an Embed wins, the matching Embed HTMLElement is retained as
 * elementTarget so generic Canvas behavior receives the real authored DOM
 * element instead of null.
 */
export function resolveCanvasPointerHit({
  embeds,
  embedTarget,
  ordinaryTarget,
}: {
  embeds: readonly HTMLElement[];
  embedTarget: CanvasPointerTarget | null;
  ordinaryTarget: HTMLElement | null;
}): CanvasPointerHit {
  const embedElement =
    (embedTarget &&
      (embeds.find((embed) => embed.dataset.powershowId === embedTarget.id) ??
        null)) ??
    null;
  const embedOverridesOrdinary =
    embedElement !== null &&
    (ordinaryTarget === null || ordinaryTarget.contains(embedElement));

  if (embedOverridesOrdinary) {
    return { elementTarget: embedElement, target: embedTarget };
  }

  if (!ordinaryTarget) {
    return { elementTarget: null, target: null };
  }

  return {
    elementTarget: ordinaryTarget,
    target: {
      id: ordinaryTarget.dataset.powershowId,
      type: ordinaryTarget.dataset.powershowType,
    },
  };
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
