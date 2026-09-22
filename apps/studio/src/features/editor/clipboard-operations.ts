import type { PresentationElement, Presentation } from "@web-slideshow/document-schema";

import {
  findContentSlotById,
  findElementById,
  findElementLocation,
} from "./element-hierarchy";
import {
  appendElementToContainer,
  appendElementToContentSlot,
  duplicateElement,
  removeElementById,
} from "./element-operations";
import { collectPresentationAuthoringIds } from "./presentation-authoring-trees";

export type ClipboardPasteDestination =
  | { kind: "slide" }
  | { kind: "container"; id: string }
  | { kind: "content-slot"; id: string };

export interface ClipboardMoveResult {
  sourceElements: PresentationElement[];
  receiverElements: PresentationElement[];
}

export function resolveClipboardPasteDestination(
  elements: readonly PresentationElement[],
  snapshotElementId: string,
  selectedElement: PresentationElement | null,
  selectedContentSlotId: string | null,
  workspaceRootContainerId: string | null = null,
): ClipboardPasteDestination | null {
  if (
    (selectedElement !== null && findElementById(elements, selectedElement.id) === null) ||
    (selectedContentSlotId !== null && findContentSlotById(elements, selectedContentSlotId) === null)
  ) {
    return null;
  }

  if (
    selectedElement?.id === snapshotElementId &&
    findElementById(elements, snapshotElementId) !== null
  ) {
    const location = findElementLocation(elements, snapshotElementId);
    if (location) {
      return location.parentRef.kind === "slide"
        ? workspaceRootContainerId === null
          ? { kind: "slide" }
          : { kind: "container", id: workspaceRootContainerId }
        : location.parentRef.kind === "container"
          ? { kind: "container", id: location.parentRef.id }
          : { kind: "content-slot", id: location.parentRef.id };
    }
  }

  if (
    selectedElement?.type === "container" &&
    findElementById(elements, selectedElement.id)?.type === "container"
  ) {
    return { kind: "container", id: selectedElement.id };
  }

  if (
    selectedContentSlotId !== null &&
    findContentSlotById(elements, selectedContentSlotId) !== null
  ) {
    return { kind: "content-slot", id: selectedContentSlotId };
  }

  return workspaceRootContainerId === null
    ? { kind: "slide" }
    : { kind: "container", id: workspaceRootContainerId };
}

export function moveClipboardElementInElements(
  presentation: Presentation,
  sourceElements: PresentationElement[],
  receiverElements: PresentationElement[],
  sourceElementId: string,
  selectedElement: PresentationElement | null,
  selectedContentSlotId: string | null,
  sameOwner: boolean,
  workspaceRootContainerId: string | null = null,
): ClipboardMoveResult | null {
  const sourceLocation = findElementLocation(sourceElements, sourceElementId);
  if (!sourceLocation) return null;

  const destination = resolveClipboardPasteDestination(
    receiverElements,
    sourceElementId,
    selectedElement,
    selectedContentSlotId,
    workspaceRootContainerId,
  );
  if (!destination) return null;

  if (sourceLocation.element.type === "container" && destination.kind !== "slide") {
    const destinationIsDescendant = destination.kind === "container"
      ? findElementById(sourceLocation.element.children, destination.id) !== null
      : findContentSlotById(sourceLocation.element.children, destination.id) !== null;
    if (destinationIsDescendant) return null;
  }

  const usedIds = collectPresentationAuthoringIds(presentation);
  const movedElement = duplicateElement(sourceLocation.element, usedIds);
  const nextReceiverElements = destination.kind === "slide"
    ? [...receiverElements, movedElement]
    : destination.kind === "container"
      ? appendElementToContainer(receiverElements, destination.id, movedElement)
      : appendElementToContentSlot(receiverElements, destination.id, movedElement);

  if (nextReceiverElements === receiverElements) return null;

  const nextSourceElements = removeElementById(
    sameOwner
      ? nextReceiverElements
      : sourceElements,
    sourceElementId,
  );

  if (nextSourceElements === sourceElements) return null;

  return {
    sourceElements: nextSourceElements,
    receiverElements: sameOwner ? nextSourceElements : nextReceiverElements,
  };
}

export function moveClipboardElement(
  presentation: Presentation,
  sourceSlideId: string,
  sourceElementId: string,
  receiverSlideIndex: number,
  selectedElement: PresentationElement | null,
  selectedContentSlotId: string | null,
): Presentation | null {
  const sourceSlideIndex = presentation.slides.findIndex((slide) => slide.id === sourceSlideId);
  const receiverSlide = presentation.slides[receiverSlideIndex];
  const sourceSlide = presentation.slides[sourceSlideIndex];
  if (!sourceSlide || !receiverSlide) return null;

  const result = moveClipboardElementInElements(
    presentation,
    sourceSlide.elements,
    receiverSlide.elements,
    sourceElementId,
    selectedElement,
    selectedContentSlotId,
    sourceSlideIndex === receiverSlideIndex,
  );
  if (!result) return null;

  return {
    ...presentation,
    slides: presentation.slides.map((slide, index) =>
      index === sourceSlideIndex
        ? { ...slide, elements: result.sourceElements }
        : index === receiverSlideIndex
          ? { ...slide, elements: result.receiverElements }
          : slide,
    ),
  };
}
