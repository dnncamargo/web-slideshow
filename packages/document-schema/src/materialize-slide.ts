import type { Presentation } from "./presentation";
import type { PresentationElement } from "./elements";
import type { Slide } from "./slide";

import {
  findRootDefinitionContainers,
  listRootDefinitionStructuralIds,
} from "./root-definition";
export type MaterializedElementOwner = "master" | "slide";

export type MaterializedSlide = Omit<
  Slide,
  "rootDefinitionId" | "localRootChildren" | "elements"
> & {
  elements: PresentationElement[];
};

export type MaterializedSlideProjection = Readonly<{
  kind: "materialized-slide";
  slide: MaterializedSlide;
  ownershipByStructuralId: ReadonlyMap<string, MaterializedElementOwner>;
}>;

function cloneCanonicalValue<T>(value: T): T {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    throw new Error("Cannot materialize a non-canonical value.");
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cloneCanonicalValue(entry)) as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Cannot materialize a non-plain canonical object.");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error("Cannot materialize a non-plain canonical object.");
  }

  const clone: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = cloneCanonicalValue(entry);
  }
  return clone as T;
}

function createMaterializedSlide(
  source: Slide,
  elements: PresentationElement[],
): MaterializedSlide {
  const clone = cloneCanonicalValue(source) as Slide;
  delete clone.rootDefinitionId;
  delete clone.localRootChildren;
  clone.elements = elements;
  return clone as MaterializedSlide;
}

function markStructuralIds(
  ownership: Map<string, MaterializedElementOwner>,
  elements: readonly PresentationElement[],
  owner: MaterializedElementOwner,
): void {
  elements.forEach((element) => {
    listRootDefinitionStructuralIds(element).forEach((id) => ownership.set(id, owner));
  });
}

export function materializeSlide(
  presentation: Presentation,
  slide: Slide,
): MaterializedSlideProjection {
  const effectiveRootDefinitionId =
    slide.rootDefinitionId ?? presentation.defaultRootDefinitionId;
  const ownershipByStructuralId = new Map<string, MaterializedElementOwner>();

  if (effectiveRootDefinitionId === undefined) {
    if ((slide.localRootChildren?.length ?? 0) > 0) {
      throw new Error("Cannot materialize local children without a Root Definition.");
    }

    const copiedElements = cloneCanonicalValue(slide.elements);
    markStructuralIds(ownershipByStructuralId, copiedElements, "slide");
    return {
      kind: "materialized-slide",
      slide: createMaterializedSlide(slide, copiedElements),
      ownershipByStructuralId,
    };
  }

  const definition = presentation.rootDefinitions?.find(
    (candidate) => candidate.id === effectiveRootDefinitionId,
  );
  if (definition === undefined) {
    throw new Error(`Cannot resolve Root Definition: ${effectiveRootDefinitionId}`);
  }
  if (slide.elements.length > 0) {
    throw new Error("Master-backed Slide must not contain ordinary elements.");
  }

  const copiedRoot = cloneCanonicalValue(definition.root);
  markStructuralIds(ownershipByStructuralId, [copiedRoot], "master");
  const copiedContainers = findRootDefinitionContainers(copiedRoot);
  const authorizedTargets = new Set(definition.localChildTargetIds ?? []);

  for (const record of slide.localRootChildren ?? []) {
    if (!authorizedTargets.has(record.targetContainerId)) {
      throw new Error(`Local child target is not authorized: ${record.targetContainerId}`);
    }

    const target = copiedContainers.get(record.targetContainerId);
    if (target === undefined) {
      throw new Error(`Cannot resolve copied target Container: ${record.targetContainerId}`);
    }

    const copiedChildren = cloneCanonicalValue(record.children);
    target.children.push(...copiedChildren);
    markStructuralIds(ownershipByStructuralId, copiedChildren, "slide");
  }

  return {
    kind: "materialized-slide",
    slide: createMaterializedSlide(slide, [copiedRoot]),
    ownershipByStructuralId,
  };
}
