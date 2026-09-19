import type { PowerShowElement, Presentation } from "@powershow/document-schema";

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

export type ClipboardPasteDestination =
  | { kind: "slide" }
  | { kind: "container"; id: string }
  | { kind: "content-slot"; id: string };

export function resolveClipboardPasteDestination(
  elements: readonly PowerShowElement[],
  snapshotElementId: string,
  selectedElement: PowerShowElement | null,
  selectedContentSlotId: string | null,
): ClipboardPasteDestination | null {
  if (
    selectedElement?.id === snapshotElementId &&
    findElementById(elements, snapshotElementId) !== null
  ) {
    const location = findElementLocation(elements, snapshotElementId);
    if (location) {
      return location.parentRef.kind === "slide"
        ? { kind: "slide" }
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

  return { kind: "slide" };
}

export function moveClipboardElement(
  presentation: Presentation,
  sourceSlideId: string,
  sourceElementId: string,
  receiverSlideIndex: number,
  selectedElement: PowerShowElement | null,
  selectedContentSlotId: string | null,
): Presentation | null {
  const sourceSlide = presentation.slides.find((slide) => slide.id === sourceSlideId);
  const receiverSlide = presentation.slides[receiverSlideIndex];
  if (!sourceSlide || !receiverSlide) return null;

  const sourceLocation = findElementLocation(sourceSlide.elements, sourceElementId);
  if (!sourceLocation) return null;

  const destination = resolveClipboardPasteDestination(
    receiverSlide.elements,
    sourceElementId,
    selectedElement,
    selectedContentSlotId,
  );
  if (!destination) return null;

  if (sourceLocation.element.type === "container" && destination.kind !== "slide") {
    const destinationIsDescendant = destination.kind === "container"
      ? findElementById(sourceLocation.element.children, destination.id) !== null
      : findContentSlotById(sourceLocation.element.children, destination.id) !== null;
    if (destinationIsDescendant) return null;
  }

  const movedElement = duplicateElement(sourceLocation.element, presentation.slides);
  const nextReceiverElements = destination.kind === "slide"
    ? [...receiverSlide.elements, movedElement]
    : destination.kind === "container"
      ? appendElementToContainer(receiverSlide.elements, destination.id, movedElement)
      : appendElementToContentSlot(receiverSlide.elements, destination.id, movedElement);

  if (nextReceiverElements === receiverSlide.elements) return null;

  const nextSlides = presentation.slides.map((slide, index) => {
    if (index === receiverSlideIndex) {
      return { ...slide, elements: nextReceiverElements };
    }
    return slide;
  });
  const sourceSlideIndex = presentation.slides.findIndex((slide) => slide.id === sourceSlideId);
  const nextSourceElements = removeElementById(
    sourceSlideIndex === receiverSlideIndex
      ? nextReceiverElements
      : sourceSlide.elements,
    sourceElementId,
  );

  if (nextSourceElements === sourceSlide.elements) return null;

  if (sourceSlideIndex === receiverSlideIndex) {
    nextSlides[receiverSlideIndex] = { ...receiverSlide, elements: nextSourceElements };
  } else {
    nextSlides[sourceSlideIndex] = { ...sourceSlide, elements: nextSourceElements };
  }

  return { ...presentation, slides: nextSlides };
}
