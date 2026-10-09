import {
  PresentationSchema,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";

import {
  findContentSlotById,
  findElementById,
} from "./element-hierarchy";
import {
  appendElementToContainer,
  appendElementToContentSlot,
  duplicateElement,
  removeElementById,
} from "./element-operations";
import {
  collectPresentationAuthoringIds,
} from "./presentation-authoring-trees";
import {
  findLocalRootChildOwner,
  isAuthorizedLocalRootReceiver,
} from "./slide-local-root-authoring";
import {
  resolveClipboardPasteDestination,
  type ClipboardPasteDestination,
} from "./clipboard-operations";

export type RootBackedClipboardPasteDestination = Readonly<{
  targetContainerId: string;
  destination: ClipboardPasteDestination;
}>;

export type RootBackedClipboardPasteResult = Readonly<{
  presentation: Presentation;
  pastedElement: PresentationElement;
}>;

function resolveSlide(
  presentation: Presentation,
  slideIndex: number,
): Presentation["slides"][number] | null {
  return presentation.slides[slideIndex] ?? null;
}

function resolveLocalRecordIndex(
  slide: Presentation["slides"][number],
  targetContainerId: string,
): number {
  return (slide.localRootChildren ?? []).findIndex(
    (record) => record.targetContainerId === targetContainerId,
  );
}

function resolveLocalRecordForContentSlot(
  slide: Presentation["slides"][number],
  contentSlotId: string,
): number {
  return (slide.localRootChildren ?? []).findIndex(
    (record) => findContentSlotById(record.children, contentSlotId) !== null,
  );
}

function appendAtDestination(
  elements: PresentationElement[],
  destination: ClipboardPasteDestination,
  element: PresentationElement,
): PresentationElement[] | null {
  if (destination.kind === "slide") {
    return [...elements, element];
  }
  if (destination.kind === "container") {
    const nextElements = appendElementToContainer(elements, destination.id, element);
    return nextElements === elements ? null : nextElements;
  }
  const nextElements = appendElementToContentSlot(elements, destination.id, element);
  return nextElements === elements ? null : nextElements;
}

function containsDestinationInSource(
  source: PresentationElement,
  destination: ClipboardPasteDestination,
): boolean {
  if (destination.kind === "slide") return false;
  return destination.kind === "container"
    ? source.type === "container" && findElementById(source.children, destination.id) !== null
    : source.type === "container" && findContentSlotById(source.children, destination.id) !== null;
}

function replaceLocalRootChildren(
  presentation: Presentation,
  slideIndex: number,
  records: readonly NonNullable<Presentation["slides"][number]["localRootChildren"]>[number][],
): Presentation | null {
  const slide = resolveSlide(presentation, slideIndex);
  if (!slide) return null;

  const nextSlide = records.length === 0
    ? (() => {
        const withoutLocalRootChildren = { ...slide };
        delete withoutLocalRootChildren.localRootChildren;
        return withoutLocalRootChildren;
      })()
    : {
        ...slide,
        localRootChildren: records.map((record) => ({
          ...record,
          children: [...record.children],
        })),
      };
  const candidate = {
    ...presentation,
    slides: presentation.slides.map((current, index) =>
      index === slideIndex ? nextSlide : current,
    ),
  };
  return PresentationSchema.safeParse(candidate).success ? candidate : null;
}

function updateLocalRecordChildren(
  records: readonly NonNullable<Presentation["slides"][number]["localRootChildren"]>[number][],
  targetContainerId: string,
  update: (children: PresentationElement[]) => PresentationElement[] | null,
): NonNullable<Presentation["slides"][number]["localRootChildren"]> | null {
  const recordIndex = records.findIndex(
    (record) => record.targetContainerId === targetContainerId,
  );
  const currentChildren = recordIndex >= 0 ? records[recordIndex]!.children : [];
  const nextChildren = update(currentChildren);
  if (nextChildren === null) return null;

  if (recordIndex < 0) {
    return nextChildren.length === 0
      ? [...records]
      : [...records, { targetContainerId, children: nextChildren }];
  }

  return nextChildren.length === 0
    ? records.filter((_, index) => index !== recordIndex)
    : records.map((record, index) =>
        index === recordIndex ? { ...record, children: nextChildren } : record,
      );
}

/**
 * Resolves a Root-backed Slide Clipboard destination in persisted coordinates.
 * The materialized master projection is only consulted to recognize an
 * authorized Container receiver; all returned destinations write to a local
 * `localRootChildren` record.
 */
export function resolveRootBackedClipboardPasteDestination(
  presentation: Presentation,
  slideIndex: number,
  snapshotElementId: string,
  selectedElement: PresentationElement | null,
  selectedContentSlotId: string | null,
): RootBackedClipboardPasteDestination | null {
  const slide = resolveSlide(presentation, slideIndex);
  if (!slide || (slide.rootDefinitionId ?? presentation.defaultRootDefinitionId) === undefined) {
    return null;
  }

  const records = slide.localRootChildren ?? [];
  const localSlotRecordIndex = selectedContentSlotId === null
    ? -1
    : resolveLocalRecordForContentSlot(slide, selectedContentSlotId);
  if (localSlotRecordIndex >= 0) {
    const record = records[localSlotRecordIndex];
    if (!record) return null;
    const localSelectedElement = selectedElement && findElementById(record.children, selectedElement.id)
      ? selectedElement
      : null;
    const destination = resolveClipboardPasteDestination(
      record.children,
      snapshotElementId,
      localSelectedElement,
      selectedContentSlotId,
    );
    return destination
      ? { targetContainerId: record.targetContainerId, destination }
      : null;
  }

  if (selectedElement) {
    const localOwner = findLocalRootChildOwner(presentation, slideIndex, selectedElement.id);
    if (localOwner) {
      const record = records[localOwner.recordIndex];
      if (!record) return null;
      const destination = resolveClipboardPasteDestination(
        record.children,
        snapshotElementId,
        selectedElement,
        null,
      );
      return destination
        ? { targetContainerId: record.targetContainerId, destination }
        : null;
    }

    if (
      selectedElement.type === "container"
      && isAuthorizedLocalRootReceiver(presentation, slide, selectedElement.id)
    ) {
      return {
        targetContainerId: selectedElement.id,
        destination: { kind: "slide" },
      };
    }
  }

  return null;
}

export function pasteRootBackedClipboardEntry(
  presentation: Presentation,
  slideIndex: number,
  entryElement: PresentationElement,
  selectedElement: PresentationElement | null,
  selectedContentSlotId: string | null,
): RootBackedClipboardPasteResult | null {
  const destination = resolveRootBackedClipboardPasteDestination(
    presentation,
    slideIndex,
    entryElement.id,
    selectedElement,
    selectedContentSlotId,
  );
  if (!destination) return null;
  if (containsDestinationInSource(entryElement, destination.destination)) return null;

  const pastedElement = duplicateElement(
    entryElement,
    collectPresentationAuthoringIds(presentation),
  );
  const slide = resolveSlide(presentation, slideIndex);
  if (!slide) return null;
  const records = slide.localRootChildren ?? [];
  const nextRecords = updateLocalRecordChildren(
    records,
    destination.targetContainerId,
    (children) => appendAtDestination(children, destination.destination, pastedElement),
  );
  if (!nextRecords) return null;
  const nextPresentation = replaceLocalRootChildren(presentation, slideIndex, nextRecords);
  return nextPresentation
    ? { presentation: nextPresentation, pastedElement }
    : null;
}

/**
 * Moves a live element between persisted Slide owners. A non-null source
 * target identifies a local Root record; null identifies the ordinary Slide
 * tree. The receiver is resolved through the existing Root-local or ordinary
 * Clipboard destination rules before the source is removed.
 */
export function moveClipboardElementAcrossSlideOwners(
  presentation: Presentation,
  sourceSlideIndex: number,
  sourceTargetContainerId: string | null,
  receiverSlideIndex: number,
  sourceElementId: string,
  selectedElement: PresentationElement | null,
  selectedContentSlotId: string | null,
): Presentation | null {
  const sourceSlide = resolveSlide(presentation, sourceSlideIndex);
  const sourceRecordIndex = sourceSlide && sourceTargetContainerId !== null
    ? resolveLocalRecordIndex(sourceSlide, sourceTargetContainerId)
    : -1;
  const sourceRecord = sourceTargetContainerId !== null && sourceRecordIndex >= 0
    ? sourceSlide?.localRootChildren?.[sourceRecordIndex]
    : undefined;
  const sourceElements = sourceTargetContainerId === null
    ? sourceSlide?.elements
    : sourceRecord?.children;
  const source = sourceElements
    ? findElementById(sourceElements, sourceElementId)
    : null;
  const receiverSlide = resolveSlide(presentation, receiverSlideIndex);
  if (!sourceSlide || !sourceElements || !source || !receiverSlide) return null;

  const receiverRootBacked = (receiverSlide.rootDefinitionId ?? presentation.defaultRootDefinitionId) !== undefined;
  const rootDestination = receiverRootBacked
    ? resolveRootBackedClipboardPasteDestination(
        presentation,
        receiverSlideIndex,
        sourceElementId,
        selectedElement,
        selectedContentSlotId,
      )
    : null;
  const destination = rootDestination?.destination ?? (
    receiverRootBacked
      ? null
      : resolveClipboardPasteDestination(
          receiverSlide.elements,
          sourceElementId,
          selectedElement,
          selectedContentSlotId,
        )
  );
  if (!destination || containsDestinationInSource(source, destination)) {
    return null;
  }

  const movedElement = duplicateElement(
    source,
    collectPresentationAuthoringIds(presentation),
  );
  const receiverElements = receiverRootBacked
    ? (() => {
        const targetContainerId = rootDestination?.targetContainerId;
        if (!targetContainerId) return null;
        const receiverRecord = receiverSlide.localRootChildren?.find(
          (record) => record.targetContainerId === targetContainerId,
        );
        return receiverRecord?.children ?? [];
      })()
    : receiverSlide.elements;
  if (receiverElements === null) return null;

  const nextReceiverElements = appendAtDestination(
    receiverElements,
    destination,
    movedElement,
  );
  if (nextReceiverElements === null) return null;

  if (
    sourceTargetContainerId !== null &&
    receiverRootBacked &&
    sourceSlideIndex === receiverSlideIndex &&
    rootDestination?.targetContainerId === sourceTargetContainerId
  ) {
    const nextElements = removeElementById(nextReceiverElements, sourceElementId);
    const nextRecords = updateLocalRecordChildren(
      sourceSlide.localRootChildren ?? [],
      sourceTargetContainerId,
      () => nextElements,
    );
    return nextRecords
      ? replaceLocalRootChildren(presentation, sourceSlideIndex, nextRecords)
      : null;
  }

  let nextPresentation = presentation;
  if (sourceTargetContainerId !== null) {
    const nextSourceElements = removeElementById(sourceElements, sourceElementId);
    const nextSourceRecords = updateLocalRecordChildren(
      sourceSlide.localRootChildren ?? [],
      sourceTargetContainerId,
      () => nextSourceElements,
    );
    if (!nextSourceRecords) return null;
    const updatedSource = replaceLocalRootChildren(
      nextPresentation,
      sourceSlideIndex,
      nextSourceRecords,
    );
    if (!updatedSource) return null;
    nextPresentation = updatedSource;
  } else {
    const nextSourceElements = removeElementById(sourceElements, sourceElementId);
    if (nextSourceElements === sourceElements) return null;
    nextPresentation = {
      ...nextPresentation,
      slides: nextPresentation.slides.map((slide, index) =>
        index === sourceSlideIndex ? { ...slide, elements: nextSourceElements } : slide,
      ),
    };
  }

  if (receiverRootBacked) {
    const targetContainerId = rootDestination?.targetContainerId;
    if (!targetContainerId) return null;
    const receiverRecords = nextPresentation.slides[receiverSlideIndex]?.localRootChildren ?? [];
    const nextRecords = updateLocalRecordChildren(
      receiverRecords,
      targetContainerId,
      () => nextReceiverElements,
    );
    if (!nextRecords) return null;
    return replaceLocalRootChildren(nextPresentation, receiverSlideIndex, nextRecords);
  }

  return {
    ...nextPresentation,
    slides: nextPresentation.slides.map((slide, index) =>
      index === receiverSlideIndex ? { ...slide, elements: nextReceiverElements } : slide,
    ),
  };
}

export function moveRootBackedClipboardElement(
  presentation: Presentation,
  slideIndex: number,
  sourceTargetContainerId: string,
  sourceElementId: string,
  selectedElement: PresentationElement | null,
  selectedContentSlotId: string | null,
): Presentation | null {
  return moveClipboardElementAcrossSlideOwners(
    presentation,
    slideIndex,
    sourceTargetContainerId,
    slideIndex,
    sourceElementId,
    selectedElement,
    selectedContentSlotId,
  );
}
