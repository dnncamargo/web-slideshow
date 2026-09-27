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
): PresentationElement[] {
  if (destination.kind === "slide") {
    return [...elements, element];
  }
  if (destination.kind === "container") {
    return appendElementToContainer(elements, destination.id, element);
  }
  return appendElementToContentSlot(elements, destination.id, element);
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

export function moveRootBackedClipboardElement(
  presentation: Presentation,
  slideIndex: number,
  sourceTargetContainerId: string,
  sourceElementId: string,
  selectedElement: PresentationElement | null,
  selectedContentSlotId: string | null,
): Presentation | null {
  const slide = resolveSlide(presentation, slideIndex);
  const sourceRecordIndex = slide
    ? resolveLocalRecordIndex(slide, sourceTargetContainerId)
    : -1;
  const sourceRecord = sourceRecordIndex >= 0
    ? slide?.localRootChildren?.[sourceRecordIndex]
    : undefined;
  const source = sourceRecord
    ? findElementById(sourceRecord.children, sourceElementId)
    : null;
  if (!slide || !sourceRecord || !source) return null;

  const destination = resolveRootBackedClipboardPasteDestination(
    presentation,
    slideIndex,
    sourceElementId,
    selectedElement,
    selectedContentSlotId,
  );
  if (!destination || containsDestinationInSource(source, destination.destination)) {
    return null;
  }

  const movedElement = duplicateElement(
    source,
    collectPresentationAuthoringIds(presentation),
  );
  const records = slide.localRootChildren ?? [];
  if (destination.targetContainerId === sourceTargetContainerId) {
    const nextChildrenWithCopy = appendAtDestination(
      sourceRecord.children,
      destination.destination,
      movedElement,
    );
    if (nextChildrenWithCopy === sourceRecord.children) return null;
    const nextChildren = removeElementById(nextChildrenWithCopy, sourceElementId);
    const nextRecords = updateLocalRecordChildren(
      records,
      sourceTargetContainerId,
      () => nextChildren,
    );
    return nextRecords ? replaceLocalRootChildren(presentation, slideIndex, nextRecords) : null;
  }

  const receiverRecordIndex = resolveLocalRecordIndex(slide, destination.targetContainerId);
  const receiverRecord = receiverRecordIndex >= 0
    ? records[receiverRecordIndex]
    : undefined;
  const nextReceiverChildren = appendAtDestination(
    receiverRecord?.children ?? [],
    destination.destination,
    movedElement,
  );
  if (nextReceiverChildren === (receiverRecord?.children ?? [])) return null;
  const nextSourceChildren = removeElementById(sourceRecord.children, sourceElementId);
  let nextRecords = updateLocalRecordChildren(
    records,
    sourceTargetContainerId,
    () => nextSourceChildren,
  );
  if (!nextRecords) return null;
  nextRecords = updateLocalRecordChildren(
    nextRecords,
    destination.targetContainerId,
    () => nextReceiverChildren,
  );
  return nextRecords ? replaceLocalRootChildren(presentation, slideIndex, nextRecords) : null;
}
