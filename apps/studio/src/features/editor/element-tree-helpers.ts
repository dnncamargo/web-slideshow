import type { PowerShowElement, Slide } from "@powershow/document-schema";

interface ParentTarget {
  id: string | null;
  label: string;
}

function getContentPreview(content: string): string | null {
  const normalized = content
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 36 ? `${normalized.slice(0, 35)}…` : normalized;
}

export function getElementLabel(element: PowerShowElement, typeLabel: string): string {
  if (element.type === "text" || element.type === "textbox") {
    const preview = getContentPreview(element.content);

    return preview ? `${typeLabel} — ${preview}` : typeLabel;
  }

  return typeLabel;
}

export function collectContainerIds(
  elements: readonly PowerShowElement[],
  ids: Set<string>,
): void {
  for (const element of elements) {
    if (element.type !== "container") {
      continue;
    }

    ids.add(element.id);
    collectContainerIds(element.children, ids);
  }
}

function collectDescendantIds(element: PowerShowElement, ids: Set<string>): void {
  ids.add(element.id);

  if (element.type === "container") {
    for (const child of element.children) {
      collectDescendantIds(child, ids);
    }
  }
}

function collectParentTargets(
  elements: readonly PowerShowElement[],
  excludedIds: ReadonlySet<string>,
  targets: ParentTarget[],
  t: (key: "tree.container" | "tree.slide") => string,
  containerCount: { value: number },
): void {
  for (const element of elements) {
    if (element.type !== "container") {
      continue;
    }

    if (!excludedIds.has(element.id)) {
      containerCount.value += 1;
      targets.push({
        id: element.id,
        label: `${t("tree.container")} ${containerCount.value}`,
      });
    }

    collectParentTargets(element.children, excludedIds, targets, t, containerCount);
  }
}

export function getParentTargets(
  slide: Slide,
  selectedElement: PowerShowElement,
  t: (key: "tree.container" | "tree.slide") => string,
): ParentTarget[] {
  const excludedIds = new Set<string>();
  collectDescendantIds(selectedElement, excludedIds);

  const targets: ParentTarget[] = [{ id: null, label: t("tree.slide") }];
  collectParentTargets(slide.elements, excludedIds, targets, t, { value: 0 });

  return targets;
}

export function getTreeActionState(
  index: number,
  siblingCount: number,
  parentId: string | null,
) {
  return {
    canMoveUp: index > 0,
    canMoveDown: index < siblingCount - 1,
    canMoveOut: parentId !== null,
  };
}
