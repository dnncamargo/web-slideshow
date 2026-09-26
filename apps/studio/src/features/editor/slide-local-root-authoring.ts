import {
  PresentationSchema,
  findRootDefinitionContainers,
  type Presentation,
  type PresentationElement,
  type Slide,
} from "@web-slideshow/document-schema";

import {
  findElementById,
  findElementLocation,
  getElementsForParentRef,
  updateElementById,
  type ElementParentRef,
} from "./element-hierarchy";
import type { MoveElementOptions } from "./element-operations";
import { replaceAuthoringElements, type AuthoringTarget } from "./authoring-target";

export type LocalRootChildOwner = Readonly<{
  targetContainerId: string;
  recordIndex: number;
}>;

export type OwnedAuthoringTree = Readonly<{
  kind: "ordinary" | "root-definition" | "slide-local-root";
  elements: PresentationElement[];
  slideIndex?: number;
  targetContainerId?: string;
}>;

function resolveSlide(
  presentation: Presentation,
  slideIndex: number,
): Slide | null {
  return presentation.slides[slideIndex] ?? null;
}

export function isAuthorizedLocalRootReceiver(
  presentation: Presentation,
  slide: Slide,
  targetContainerId: string,
): boolean {
  const rootDefinitionId = slide.rootDefinitionId ?? presentation.defaultRootDefinitionId;
  const definition = presentation.rootDefinitions?.find((candidate) => candidate.id === rootDefinitionId);
  return definition !== undefined
    && (definition.localChildTargetIds ?? []).includes(targetContainerId)
    && findRootDefinitionContainers(definition.root).has(targetContainerId);
}

export function findLocalRootChildOwner(
  presentation: Presentation,
  slideIndex: number,
  elementId: string,
): LocalRootChildOwner | null {
  const slide = resolveSlide(presentation, slideIndex);
  if (!slide) return null;

  const recordIndex = (slide.localRootChildren ?? []).findIndex((record) =>
    findElementById(record.children, elementId) !== null,
  );
  const record = recordIndex >= 0 ? slide.localRootChildren?.[recordIndex] : undefined;
  return record === undefined
    ? null
    : { targetContainerId: record.targetContainerId, recordIndex };
}

export function resolveOwnedAuthoringTree(
  presentation: Presentation,
  target: AuthoringTarget,
  anchorElementId?: string,
): OwnedAuthoringTree | null {
  if (target.kind === "root-definition") {
    const root = presentation.rootDefinitions?.find((definition) => definition.id === target.rootDefinitionId)?.root;
    return root ? { kind: "root-definition", elements: [root] } : null;
  }

  const slide = resolveSlide(presentation, target.slideIndex);
  if (!slide) return null;
  const rootBacked = (slide.rootDefinitionId ?? presentation.defaultRootDefinitionId) !== undefined;
  if (!rootBacked) return { kind: "ordinary", elements: slide.elements };
  if (anchorElementId === undefined) return null;
  const owner = findLocalRootChildOwner(presentation, target.slideIndex, anchorElementId);
  if (!owner) return null;
  const record = slide.localRootChildren?.[owner.recordIndex];
  return record
    ? { kind: "slide-local-root", slideIndex: target.slideIndex, targetContainerId: owner.targetContainerId, elements: record.children }
    : null;
}

export function replaceOwnedAuthoringTree(
  presentation: Presentation,
  target: AuthoringTarget,
  anchorElementId: string,
  nextElements: PresentationElement[],
): Presentation {
  const owned = resolveOwnedAuthoringTree(presentation, target, anchorElementId);
  if (!owned) return presentation;
  if (owned.kind === "slide-local-root") {
    return updateLocalRootChildren(presentation, owned.slideIndex!, owned.targetContainerId!, () => nextElements);
  }
  return replaceAuthoringElements(presentation, target, nextElements);
}

export function updateOwnedAuthoringTree(
  presentation: Presentation,
  target: AuthoringTarget,
  anchorElementId: string,
  update: (elements: PresentationElement[]) => PresentationElement[],
): Presentation {
  const owned = resolveOwnedAuthoringTree(presentation, target, anchorElementId);
  if (!owned) return presentation;
  const nextElements = update(owned.elements);
  return nextElements === owned.elements ? presentation : replaceOwnedAuthoringTree(presentation, target, anchorElementId, nextElements);
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

/**
 * Converts a drop calculated against the materialized Root-backed Slide into
 * an index in the selected localRootChildren record. Master siblings are
 * deliberately not valid insertion anchors.
 */
export function normalizeRootBackedMoveOptions(
  presentation: Presentation,
  target: AuthoringTarget,
  effectiveElements: PresentationElement[],
  options: MoveElementOptions,
): MoveElementOptions | null {
  if (target.kind !== "slide") return options;

  const owned = resolveOwnedAuthoringTree(presentation, target, options.elementId);
  if (owned?.kind !== "slide-local-root") return null;

  const sourceEffective = findElementLocation(effectiveElements, options.elementId);
  const sourceOwned = findElementLocation(owned.elements, options.elementId);
  if (!sourceEffective || !sourceOwned) return null;

  const targetParentRef = options.targetParentRef;
  const normalizedParentRef: ElementParentRef =
    targetParentRef.kind === "container" && targetParentRef.id === owned.targetContainerId
      ? { kind: "slide" }
      : targetParentRef.kind === "slide"
        ? { kind: "slide" }
        : targetParentRef;

  // A materialized Slide root is the canonical Root Container, not the local
  // owner boundary. Local content can only target its receiver or another
  // parent that is present in the same persisted owner tree.
  if (targetParentRef.kind === "slide") return null;

  const effectiveTargetElements = getElementsForParentRef(effectiveElements, targetParentRef);
  const ownedTargetElements = getElementsForParentRef(owned.elements, normalizedParentRef);
  if (!effectiveTargetElements || !ownedTargetElements) return null;

  const effectiveAfterSource = areElementParentRefsEqual(sourceEffective.parentRef, targetParentRef)
    ? effectiveTargetElements.filter((element) => element.id !== options.elementId)
    : effectiveTargetElements;
  const ownedAfterSource = areElementParentRefsEqual(sourceOwned.parentRef, normalizedParentRef)
    ? ownedTargetElements.filter((element) => element.id !== options.elementId)
    : ownedTargetElements;
  const effectiveIndex = options.targetIndex ?? effectiveAfterSource.length;
  if (effectiveIndex < 0 || effectiveIndex > effectiveAfterSource.length) return null;

  const anchor = effectiveAfterSource[effectiveIndex];
  const normalizedIndex = anchor === undefined
    ? ownedAfterSource.length
    : ownedAfterSource.findIndex((element) => element.id === anchor.id);
  if (normalizedIndex < 0) return null;

  return {
    ...options,
    targetParentRef: normalizedParentRef,
    targetIndex: normalizedIndex,
  };
}

export function updateLocalRootChildren(
  presentation: Presentation,
  slideIndex: number,
  targetContainerId: string,
  update: (children: PresentationElement[]) => PresentationElement[],
): Presentation {
  const slide = resolveSlide(presentation, slideIndex);
  if (!slide || !isAuthorizedLocalRootReceiver(presentation, slide, targetContainerId)) {
    return presentation;
  }

  const records = slide.localRootChildren ?? [];
  const recordIndex = records.findIndex((record) => record.targetContainerId === targetContainerId);
  const currentChildren = recordIndex >= 0 ? records[recordIndex]!.children : [];
  const nextChildren = update(currentChildren);
  if (nextChildren === currentChildren) return presentation;

  const nextRecords = recordIndex >= 0
    ? nextChildren.length === 0
      ? records.filter((_, index) => index !== recordIndex)
      : records.map((record, index) => index === recordIndex ? { ...record, children: nextChildren } : record)
    : nextChildren.length === 0
      ? records
      : [...records, { targetContainerId, children: nextChildren }];

  const nextSlide = nextRecords.length === 0
    ? (() => {
        const { localRootChildren: _localRootChildren, ...withoutLocalRootChildren } = slide;
        return withoutLocalRootChildren;
      })()
    : { ...slide, localRootChildren: nextRecords };
  const candidate = {
    ...presentation,
    slides: presentation.slides.map((current, index) => index === slideIndex ? nextSlide : current),
  };
  return PresentationSchema.safeParse(candidate).success ? candidate : presentation;
}

export function updateLocalRootElement(
  presentation: Presentation,
  slideIndex: number,
  elementId: string,
  update: (element: PresentationElement) => PresentationElement,
): Presentation {
  const owner = findLocalRootChildOwner(presentation, slideIndex, elementId);
  if (!owner) return presentation;
  return updateLocalRootChildren(
    presentation,
    slideIndex,
    owner.targetContainerId,
    (children) => updateElementById(children, elementId, update),
  );
}
