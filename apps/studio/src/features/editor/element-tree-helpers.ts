import type {
  PowerShowElement,
  Slide,
  TopicItem,
} from "@powershow/document-schema";

import {
  findElementSiblingPosition,
  type MoveElementOptions,
} from "./element-operations";
import {
  collectAuthoringIds,
  collectContainerIds as collectContainerIdsInHierarchy,
  type ElementParentRef,
} from "./element-hierarchy";
import { findElementById } from "./element-tree";

interface ParentTarget {
  id: string | null;
  label: string;
}

function summarizeTextContent(
  content: string | { type: "rich-text"; runs: readonly { text: string }[] },
): string {
  return typeof content === "string"
    ? content
    : content.runs.map((run) => run.text).join("");
}

function collectParentTargetsInTopicItems(
  items: readonly TopicItem[],
  excludedIds: ReadonlySet<string>,
  targets: ParentTarget[],
  t: (key: "tree.container" | "tree.slide") => string,
  containerCount: { value: number },
): void {
  for (const item of items) {
    collectParentTargets(
      item.content.children,
      excludedIds,
      targets,
      t,
      containerCount,
    );
    collectParentTargetsInTopicItems(
      item.children,
      excludedIds,
      targets,
      t,
      containerCount,
    );
  }
}

function getContentPreview(
  content: string | { type: "rich-text"; runs: readonly { text: string }[] },
): string | null {
  const normalized = summarizeTextContent(content)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 36 ? `${normalized.slice(0, 35)}…` : normalized;
}

export function getElementLabel(
  element: PowerShowElement,
  typeLabel: string,
): string {
  if (element.type === "text" || element.type === "textbox") {
    const preview = getContentPreview(element.content);

    return preview ? `${typeLabel} — ${preview}` : typeLabel;
  }

  return typeLabel;
}

/**
 * Children exposed by a Selector tree node.
 *
 * Only generic PowerShowElement containers expose direct children here.
 * Topics are rendered through their own structural tree nodes in the panel.
 */
export function getElementTreeChildren(
  element: PowerShowElement,
): PowerShowElement[] {
  if (element.type === "container") {
    return element.children;
  }

  return [];
}

export function collectContainerIds(
  elements: readonly PowerShowElement[],
  ids: Set<string>,
): void {
  collectContainerIdsInHierarchy(elements, ids);
}

function collectParentTargets(
  elements: readonly PowerShowElement[],
  excludedIds: ReadonlySet<string>,
  targets: ParentTarget[],
  t: (key: "tree.container" | "tree.slide") => string,
  containerCount: { value: number },
): void {
  for (const element of elements) {
    if (element.type === "container") {
      if (!excludedIds.has(element.id)) {
        containerCount.value += 1;
        targets.push({
          id: element.id,
          label: `${t("tree.container")} ${containerCount.value}`,
        });
      }

      collectParentTargets(
        element.children,
        excludedIds,
        targets,
        t,
        containerCount,
      );
      continue;
    }

    if (element.type === "topics") {
      collectParentTargetsInTopicItems(
        element.items,
        excludedIds,
        targets,
        t,
        containerCount,
      );
    }
  }
}

export function getParentTargets(
  slide: Slide,
  selectedElement: PowerShowElement,
  t: (key: "tree.container" | "tree.slide") => string,
): ParentTarget[] {
  const excludedIds = new Set<string>();
  collectAuthoringIds(selectedElement, excludedIds);

  const targets: ParentTarget[] = [{ id: null, label: t("tree.slide") }];
  collectParentTargets(slide.elements, excludedIds, targets, t, { value: 0 });

  return targets;
}

export function getTreeActionState(
  index: number,
  siblingCount: number,
  parentRef: ElementParentRef,
) {
  return {
    canMoveUp: index > 0,
    canMoveDown: index < siblingCount - 1,
    canMoveOut: parentRef.kind === "container",
  };
}

export type TreeDropIntent = "before" | "after" | "inside";

export function resolveTreeDrop(
  elements: PowerShowElement[],
  elementId: string,
  targetId: string,
  intent: TreeDropIntent,
): MoveElementOptions | null {
  if (elementId === targetId) {
    return null;
  }

  const sourcePosition = findElementSiblingPosition(elements, elementId);
  const targetPosition = findElementSiblingPosition(elements, targetId);
  const source = findElementById(elements, elementId);
  const target = findElementById(elements, targetId);

  if (!sourcePosition || !targetPosition || !source || !target) {
    return null;
  }

  const forbiddenIds = new Set<string>();
  collectAuthoringIds(source, forbiddenIds);

  if (forbiddenIds.has(targetId)) {
    return null;
  }

  if (intent === "inside") {
    return target.type === "container"
      ? { elementId, targetParentRef: { kind: "container", id: target.id } }
      : null;
  }

  function areElementParentRefsEqual(
    left: ElementParentRef,
    right: ElementParentRef,
  ): boolean {
    switch (left.kind) {
      case "slide":
        return right.kind === "slide";

      case "container":
        return right.kind === "container" && left.id === right.id;

      case "content-slot":
        return right.kind === "content-slot" && left.id === right.id;
    }
  }

  const sourceIsBeforeTarget =
    areElementParentRefsEqual(
      sourcePosition.parentRef,
      targetPosition.parentRef,
    ) && sourcePosition.index < targetPosition.index;
  const targetIndex = targetPosition.index - (sourceIsBeforeTarget ? 1 : 0);

  return {
    elementId,
    targetParentRef: targetPosition.parentRef,
    targetIndex: intent === "before" ? targetIndex : targetIndex + 1,
  };
}
