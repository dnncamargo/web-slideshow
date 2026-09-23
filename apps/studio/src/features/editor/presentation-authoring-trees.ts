import type {
  Presentation,
  PresentationElement,
} from "@web-slideshow/document-schema";

import { collectAuthoringIds } from "./element-hierarchy";
import type { AuthoringTarget } from "./authoring-target";

export type PresentationAuthoringTreeVisitor = (
  elements: readonly PresentationElement[],
) => void;

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
