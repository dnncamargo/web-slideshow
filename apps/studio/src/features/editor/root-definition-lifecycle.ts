import {
  PresentationSchema,
  findRootDefinitionContainers,
  listRootDefinitionStructuralIds,
  type Presentation,
  type RootDefinition,
} from "@web-slideshow/document-schema";

import { createRootPresetContainer, createUniqueId, type SlideLayoutPreset } from "./preset-structure";
import { collectPresentationAuthoringIds } from "./presentation-authoring-trees";

export type RootDefinitionLifecycleFailure =
  | "not-found"
  | "slide-not-found"
  | "root-not-found"
  | "invalid-name"
  | "referenced"
  | "incompatible"
  | "container-not-found"
  | "not-container"
  | "in-use"
  | "no-op"
  | "invalid-result";

export type RootDefinitionLifecycleOutcome<T = undefined> =
  | {
      readonly ok: true;
      readonly presentation: Presentation;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly reason: RootDefinitionLifecycleFailure;
    };

function invalidResult<T>(): RootDefinitionLifecycleOutcome<T> {
  return { ok: false, reason: "invalid-result" };
}

function validated<T>(
  presentation: Presentation,
  value: T,
): RootDefinitionLifecycleOutcome<T> {
  return PresentationSchema.safeParse(presentation).success
    ? { ok: true, presentation, value }
    : invalidResult<T>();
}

function findRootDefinition(
  presentation: Presentation,
  rootDefinitionId: string,
): { definition: RootDefinition; index: number } | null {
  const definitions = presentation.rootDefinitions ?? [];
  const index = definitions.findIndex((definition) => definition.id === rootDefinitionId);
  const definition = index >= 0 ? definitions[index] : undefined;
  return definition === undefined ? null : { definition, index };
}

export function resolveEffectiveRootDefinitionId(
  presentation: Presentation,
  slide: Presentation["slides"][number],
): string | undefined {
  return slide.rootDefinitionId ?? presentation.defaultRootDefinitionId;
}

/** Authorizes one Container in a Root Definition to receive future local Slide content. */
export function setRootDefinitionLocalChildTarget(
  presentation: Presentation,
  rootDefinitionId: string,
  containerId: string,
  allowed: boolean,
): RootDefinitionLifecycleOutcome {
  const found = findRootDefinition(presentation, rootDefinitionId);
  if (found === null) return { ok: false, reason: "root-not-found" };

  const containers = findRootDefinitionContainers(found.definition.root);
  if (!containers.has(containerId)) {
    return listRootDefinitionStructuralIds(found.definition.root).includes(containerId)
      ? { ok: false, reason: "not-container" }
      : { ok: false, reason: "container-not-found" };
  }

  const currentTargets = found.definition.localChildTargetIds ?? [];
  const currentlyAllowed = currentTargets.includes(containerId);
  if (currentlyAllowed === allowed) return { ok: false, reason: "no-op" };

  if (!allowed) {
    const inUse = presentation.slides.some((slide) =>
      resolveEffectiveRootDefinitionId(presentation, slide) === rootDefinitionId
      && (slide.localRootChildren ?? []).some((local) => local.targetContainerId === containerId),
    );
    if (inUse) return { ok: false, reason: "in-use" };
  }

  const nextTargets = allowed
    ? [...currentTargets, containerId]
    : currentTargets.filter((targetId) => targetId !== containerId);
  const nextDefinition = nextTargets.length === 0
    ? (({ localChildTargetIds: _targets, ...withoutTargets }) => withoutTargets)(found.definition)
    : { ...found.definition, localChildTargetIds: nextTargets };
  const rootDefinitions = (presentation.rootDefinitions ?? []).map((definition, index) =>
    index === found.index ? nextDefinition : definition,
  );

  return validated({ ...presentation, rootDefinitions }, undefined);
}

/** Creates one independent canonical Root Definition from a shared preset tree. */
export function createRootDefinitionFromPreset(
  presentation: Presentation,
  preset: SlideLayoutPreset,
  name: string,
): RootDefinitionLifecycleOutcome<string> {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { ok: false, reason: "invalid-name" };
  }

  const usedIds = collectPresentationAuthoringIds(presentation);
  const rootDefinitionId = createUniqueId("root-definition", usedIds);
  const root: RootDefinition["root"] = createRootPresetContainer(
    preset,
    rootDefinitionId,
    usedIds,
  );
  const rootDefinition: RootDefinition = {
    id: rootDefinitionId,
    name: trimmedName,
    root,
  };
  const rootDefinitions = [
    ...(presentation.rootDefinitions ?? []),
    rootDefinition,
  ];

  return validated(
    { ...presentation, rootDefinitions },
    rootDefinitionId,
  );
}

/** Renames an existing Root Definition without changing its tree or references. */
export function renameRootDefinition(
  presentation: Presentation,
  rootDefinitionId: string,
  name: string,
): RootDefinitionLifecycleOutcome {
  const found = findRootDefinition(presentation, rootDefinitionId);
  if (found === null) {
    return { ok: false, reason: "not-found" };
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { ok: false, reason: "invalid-name" };
  }
  if (trimmedName === found.definition.name) {
    return { ok: false, reason: "no-op" };
  }

  const rootDefinitions = (presentation.rootDefinitions ?? []).map((definition, index) =>
    index === found.index ? { ...definition, name: trimmedName } : definition,
  );

  return validated({ ...presentation, rootDefinitions }, undefined);
}

/** Deletes an unused Root Definition and leaves all references untouched. */
export function deleteRootDefinition(
  presentation: Presentation,
  rootDefinitionId: string,
): RootDefinitionLifecycleOutcome {
  const found = findRootDefinition(presentation, rootDefinitionId);
  if (found === null) {
    return { ok: false, reason: "not-found" };
  }

  const isReferenced = presentation.defaultRootDefinitionId === rootDefinitionId
    || presentation.slides.some((slide) => slide.rootDefinitionId === rootDefinitionId);
  if (isReferenced) {
    return { ok: false, reason: "referenced" };
  }

  const remaining = (presentation.rootDefinitions ?? []).filter(
    (definition) => definition.id !== rootDefinitionId,
  );
  const nextPresentation: Presentation = remaining.length === 0
    ? (({ rootDefinitions: _rootDefinitions, ...withoutRootDefinitions }) => withoutRootDefinitions)(presentation)
    : { ...presentation, rootDefinitions: remaining };

  return validated(nextPresentation, undefined);
}

/** Assigns or clears a Slide's explicit Root Definition reference without materializing content. */
export function setSlideRootDefinition(
  presentation: Presentation,
  slideId: string,
  rootDefinitionId: string | undefined,
): RootDefinitionLifecycleOutcome {
  const slide = presentation.slides.find((candidate) => candidate.id === slideId);
  if (!slide) return { ok: false, reason: "slide-not-found" };
  if (rootDefinitionId !== undefined && !findRootDefinition(presentation, rootDefinitionId)) {
    return { ok: false, reason: "root-not-found" };
  }
  if (slide.rootDefinitionId === rootDefinitionId) {
    return { ok: false, reason: "no-op" };
  }

  const slides = presentation.slides.map((candidate) => {
    if (candidate.id !== slideId) return candidate;
    if (rootDefinitionId === undefined) {
      const { rootDefinitionId: _rootDefinitionId, ...withoutRootDefinition } = candidate;
      return withoutRootDefinition;
    }
    return { ...candidate, rootDefinitionId };
  });
  const candidate = { ...presentation, slides };
  return PresentationSchema.safeParse(candidate).success
    ? { ok: true, presentation: candidate, value: undefined }
    : { ok: false, reason: "incompatible" };
}
