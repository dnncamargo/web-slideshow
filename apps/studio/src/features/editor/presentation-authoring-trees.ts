import type {
  Presentation,
  PresentationElement,
} from "@web-slideshow/document-schema";

import { collectAuthoringIds } from "./element-hierarchy";
import type { AuthoringTarget } from "./authoring-target";

export type PresentationAuthoringTreeVisitor = (
  elements: readonly PresentationElement[],
) => void;

export type PresentationAuthoringTreeUpdater = (
  elements: readonly PresentationElement[],
) => readonly PresentationElement[];

export type NavigablePresentationAuthoringTreeVisitor = (
  elements: readonly PresentationElement[],
  target: AuthoringTarget,
) => void;

/** Visits only the canonical owner trees currently exposed by AuthoringTarget. */
export function forEachNavigablePresentationAuthoringTree(
  presentation: Presentation,
  visit: NavigablePresentationAuthoringTreeVisitor,
): void {
  presentation.slides.forEach((slide, slideIndex) => {
    visit(slide.elements, { kind: "slide", slideIndex });
  });

  for (const rootDefinition of presentation.rootDefinitions ?? []) {
    visit([rootDefinition.root], {
      kind: "root-definition",
      rootDefinitionId: rootDefinition.id,
    });
  }
}

/** Visits each persisted PresentationElement ownership tree exactly once. */
export function forEachPresentationAuthoringTree(
  presentation: Presentation,
  visit: PresentationAuthoringTreeVisitor,
): void {
  for (const slide of presentation.slides) {
    visit(slide.elements);

    for (const localRootChildren of slide.localRootChildren ?? []) {
      visit(localRootChildren.children);
    }
  }

  for (const rootDefinition of presentation.rootDefinitions ?? []) {
    visit([rootDefinition.root]);
  }
}

/**
 * Applies an element-array update to every persisted authoring owner tree.
 *
 * Navigable ownership and persisted ownership are intentionally different:
 * localRootChildren are included here for global mutations but are not given
 * an AuthoringTarget.
 */
export function updatePresentationAuthoringTrees(
  presentation: Presentation,
  update: PresentationAuthoringTreeUpdater,
): Presentation {
  let slidesChanged = false;
  const slides = presentation.slides.map((slide) => {
    const elements = update(slide.elements);
    let localRootChildrenChanged = false;
    const localRootChildren = slide.localRootChildren?.map((entry) => {
      const children = update(entry.children);
      if (children === entry.children) return entry;
      localRootChildrenChanged = true;
      return { ...entry, children: children as PresentationElement[] };
    });

    if (
      elements === slide.elements
      && !localRootChildrenChanged
    ) {
      return slide;
    }

    slidesChanged = true;
    return {
      ...slide,
      ...(elements === slide.elements ? {} : { elements: elements as PresentationElement[] }),
      ...(localRootChildrenChanged ? { localRootChildren } : {}),
    };
  });

  let rootDefinitionsChanged = false;
  const rootDefinitions = presentation.rootDefinitions?.map((rootDefinition) => {
    const rootElements = update([rootDefinition.root]);
    const candidate = rootElements.length === 1 ? rootElements[0] : undefined;
    const root = candidate?.type === "container" ? candidate : rootDefinition.root;
    if (root === rootDefinition.root) return rootDefinition;
    rootDefinitionsChanged = true;
    return { ...rootDefinition, root };
  });

  if (!slidesChanged && !rootDefinitionsChanged) return presentation;
  return {
    ...presentation,
    ...(slidesChanged ? { slides } : {}),
    ...(rootDefinitionsChanged ? { rootDefinitions } : {}),
  };
}

/** Collects every canonical authoring identity in a Presentation. */
export function collectPresentationAuthoringIds(
  presentation: Presentation,
): Set<string> {
  const ids = new Set<string>();

  for (const slide of presentation.slides) {
    ids.add(slide.id);
  }

  for (const rootDefinition of presentation.rootDefinitions ?? []) {
    ids.add(rootDefinition.id);
  }

  forEachPresentationAuthoringTree(presentation, (elements) => {
    for (const element of elements) {
      collectAuthoringIds(element, ids);
    }
  });

  return ids;
}
