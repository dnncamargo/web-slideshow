import {
  findRootDefinitionContainers,
  PresentationSchema,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";

import {
  findElementLocation,
  getElementsForParentRef,
  updateElementById,
} from "./element-hierarchy";
import { unwrapContainerPreservingChildren } from "./element-operations";
import { resolveEffectiveRootDefinitionId } from "./root-definition-lifecycle";

export type RootLocalContentDeletionFailure =
  | "root-not-found"
  | "container-not-found"
  | "not-container"
  | "canonical-root"
  | "not-local-receiver"
  | "parent-not-container"
  | "not-last-master-child"
  | "invalid-result";

export type RootLocalContentDeletionResult =
  | { readonly ok: true; readonly presentation: Presentation }
  | { readonly ok: false; readonly reason: RootLocalContentDeletionFailure };

function findRootDefinition(
  presentation: Presentation,
  rootDefinitionId: string,
): { definition: NonNullable<Presentation["rootDefinitions"]>[number]; index: number } | null {
  const definitions = presentation.rootDefinitions ?? [];
  const index = definitions.findIndex((definition) => definition.id === rootDefinitionId);
  const definition = index >= 0 ? definitions[index] : undefined;
  return definition === undefined ? null : { definition, index };
}

function transferSlideLocalRecords(
  slide: Presentation["slides"][number],
  receiverId: string,
  parentId: string,
): Presentation["slides"][number] {
  const records = slide.localRootChildren ?? [];
  const transferred = records
    .filter((record) => record.targetContainerId === receiverId)
    .flatMap((record) => record.children);
  const parentIndex = records.findIndex((record) => record.targetContainerId === parentId);

  if (parentIndex < 0) {
    return {
      ...slide,
      localRootChildren: records.map((record) => record.targetContainerId === receiverId
        ? { ...record, targetContainerId: parentId }
        : record),
    };
  }

  const nextRecords = records.flatMap((record, index) => {
    if (record.targetContainerId === receiverId) return [];
    if (index !== parentIndex) return [record];
    return [{ ...record, children: [...transferred, ...record.children] }];
  });

  return { ...slide, localRootChildren: nextRecords };
}

function removeEmptyContainerFromParent(
  root: Extract<PresentationElement, { type: "container" }>,
  containerId: string,
  parentId: string,
): Extract<PresentationElement, { type: "container" }> | null {
  const nextElements = updateElementById([root], parentId, (element) => {
    if (element.type !== "container") return element;
    const nextChildren = element.children.filter((child) => child.id !== containerId);
    return nextChildren.length === element.children.length
      ? element
      : { ...element, children: nextChildren };
  });
  const nextRoot = nextElements[0];
  return nextRoot?.type === "container" && nextRoot !== root ? nextRoot : null;
}

/**
 * Removes an in-use Root Definition Container while preserving its Slide-owned
 * local children through the surviving direct Container parent.
 */
export function preserveRootDefinitionContainerDeletion(
  presentation: Presentation,
  rootDefinitionId: string,
  containerId: string,
): RootLocalContentDeletionResult {
  const found = findRootDefinition(presentation, rootDefinitionId);
  if (found === null) return { ok: false, reason: "root-not-found" };

  if (found.definition.root.id === containerId) {
    return { ok: false, reason: "canonical-root" };
  }

  const containers = findRootDefinitionContainers(found.definition.root);
  const deletedContainer = containers.get(containerId);
  if (deletedContainer === undefined) {
    return { ok: false, reason: "container-not-found" };
  }

  const affectedSlides = presentation.slides.filter((slide) =>
    resolveEffectiveRootDefinitionId(presentation, slide) === rootDefinitionId
    && (slide.localRootChildren ?? []).some((record) => record.targetContainerId === containerId),
  );
  if (affectedSlides.length === 0) {
    return { ok: false, reason: "not-local-receiver" };
  }

  const location = findElementLocation([found.definition.root], containerId);
  if (location === null) return { ok: false, reason: "container-not-found" };
  if (location.element.type !== "container") return { ok: false, reason: "not-container" };
  if (location.parentRef.kind !== "container") {
    return { ok: false, reason: "parent-not-container" };
  }
  const parentId = location.parentRef.id;

  const parentChildren = getElementsForParentRef([found.definition.root], location.parentRef);
  if (parentChildren === null) return { ok: false, reason: "parent-not-container" };
  if (location.index !== parentChildren.length - 1) {
    return { ok: false, reason: "not-last-master-child" };
  }

  const nextRoot = (() => {
    if (deletedContainer.children.length === 0) {
      return removeEmptyContainerFromParent(found.definition.root, containerId, parentId);
    }

    const unwrapped = unwrapContainerPreservingChildren([found.definition.root], containerId);
    return unwrapped.changed ? unwrapped.elements[0] : null;
  })();
  if (nextRoot?.type !== "container") {
    return { ok: false, reason: "invalid-result" };
  }

  const currentTargets = found.definition.localChildTargetIds ?? [];
  const nextTargets = currentTargets.filter((targetId) => targetId !== containerId);
  if (!nextTargets.includes(parentId)) {
    nextTargets.push(parentId);
  }

  const nextSlides = presentation.slides.map((slide) =>
    resolveEffectiveRootDefinitionId(presentation, slide) === rootDefinitionId
      && (slide.localRootChildren ?? []).some((record) => record.targetContainerId === containerId)
      ? transferSlideLocalRecords(slide, containerId, parentId)
      : slide,
  );
  const nextDefinition = {
    ...found.definition,
    root: nextRoot,
    localChildTargetIds: nextTargets,
  };
  const candidate = {
    ...presentation,
    slides: nextSlides,
    rootDefinitions: (presentation.rootDefinitions ?? []).map((definition, index) =>
      index === found.index ? nextDefinition : definition,
    ),
  };

  return PresentationSchema.safeParse(candidate).success
    ? { ok: true, presentation: candidate }
    : { ok: false, reason: "invalid-result" };
}
