import type {
  Presentation,
  PresentationElement,
} from "@web-slideshow/document-schema";

import { collectAuthoringIds } from "./element-hierarchy";

export type PresentationAuthoringTreeVisitor = (
  elements: readonly PresentationElement[],
) => void;

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
