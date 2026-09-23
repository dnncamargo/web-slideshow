import type {
  Presentation,
  PresentationElement,
  Slide,
} from "@web-slideshow/document-schema";
import {
  PresentationSchema,
  findRootDefinitionContainers,
} from "@web-slideshow/document-schema";
import { resolveEffectiveRootDefinitionId } from "./root-definition-lifecycle";

export type AuthoringTarget =
  | {
      readonly kind: "slide";
      readonly slideIndex: number;
    }
  | {
      readonly kind: "root-definition";
      readonly rootDefinitionId: string;
    };

export type ResolvedAuthoringTarget = {
  readonly elements: PresentationElement[];
  readonly slide: Slide;
};

function isValidSlideIndex(slideIndex: number): boolean {
  return Number.isInteger(slideIndex) && slideIndex >= 0;
}

function resolveRootDefinition(
  presentation: Presentation,
  target: Extract<AuthoringTarget, { kind: "root-definition" }>,
) {
  return presentation.rootDefinitions?.find(
    (definition) => definition.id === target.rootDefinitionId,
  );
}

export function isRootDefinitionTarget(
  target: AuthoringTarget,
): target is Extract<AuthoringTarget, { kind: "root-definition" }> {
  return target.kind === "root-definition";
}

export function resolveAuthoringElements(
  presentation: Presentation,
  target: AuthoringTarget,
): PresentationElement[] | null {
  if (target.kind === "slide") {
    if (!isValidSlideIndex(target.slideIndex)) return null;
    return presentation.slides[target.slideIndex]?.elements ?? null;
  }

  const definition = resolveRootDefinition(presentation, target);
  return definition ? [definition.root] : null;
}

export function updateAuthoringElements(
  presentation: Presentation,
  target: AuthoringTarget,
  update: (elements: PresentationElement[]) => PresentationElement[],
): Presentation {
  const currentElements = resolveAuthoringElements(presentation, target);
  if (currentElements === null) return presentation;

  const nextElements = update(currentElements);
  return nextElements === currentElements
    ? presentation
    : replaceAuthoringElements(presentation, target, nextElements);
}

export function resolveAuthoringSlide(
  presentation: Presentation,
  target: AuthoringTarget,
): Slide | null {
  if (target.kind === "slide") {
    if (!isValidSlideIndex(target.slideIndex)) return null;
    return presentation.slides[target.slideIndex] ?? null;
  }

  const definition = resolveRootDefinition(presentation, target);
  if (!definition) return null;

  return {
    id: `root-definition-workspace:${definition.id}`,
    title: definition.name,
    summary: "",
    speakerNotes: "",
    elements: [definition.root],
  };
}

export function resolveAuthoringTarget(
  presentation: Presentation,
  target: AuthoringTarget,
): ResolvedAuthoringTarget | null {
  const slide = resolveAuthoringSlide(presentation, target);
  const elements = resolveAuthoringElements(presentation, target);
  return slide && elements ? { slide, elements } : null;
}

export function replaceAuthoringElements(
  presentation: Presentation,
  target: AuthoringTarget,
  nextElements: PresentationElement[],
): Presentation {
  if (target.kind === "slide") {
    if (!isValidSlideIndex(target.slideIndex) || !presentation.slides[target.slideIndex]) {
      return presentation;
    }

    return {
      ...presentation,
      slides: presentation.slides.map((slide, index) =>
        index === target.slideIndex ? { ...slide, elements: nextElements } : slide,
      ),
    };
  }

  if (nextElements.length !== 1 || nextElements[0]?.type !== "container") {
    return presentation;
  }

  const definitions = presentation.rootDefinitions;
  const definitionIndex = definitions?.findIndex(
    (definition) => definition.id === target.rootDefinitionId,
  ) ?? -1;
  const definition = definitionIndex >= 0 ? definitions?.[definitionIndex] : undefined;
  const nextRoot = nextElements[0];
  if (!definition || !nextRoot || nextRoot.id !== definition.root.id) {
    return presentation;
  }

  const currentTargets = definition.localChildTargetIds ?? [];
  const nextContainers = findRootDefinitionContainers(nextRoot);
  const removedTargets = currentTargets.filter((containerId) => !nextContainers.has(containerId));
  const removesUsedTarget = removedTargets.some((containerId) =>
    presentation.slides.some((slide) =>
      resolveEffectiveRootDefinitionId(presentation, slide) === definition.id
      && (slide.localRootChildren ?? []).some((local) => local.targetContainerId === containerId),
    ),
  );
  if (removesUsedTarget) return presentation;

  const nextDefinition = currentTargets.length === 0 || removedTargets.length === 0
    ? { ...definition, root: nextRoot }
    : currentTargets.filter((containerId) => nextContainers.has(containerId)).length === 0
      ? (({ localChildTargetIds: _targets, ...withoutTargets }) => ({ ...withoutTargets, root: nextRoot }))(definition)
      : {
          ...definition,
          root: nextRoot,
          localChildTargetIds: currentTargets.filter((containerId) => nextContainers.has(containerId)),
        };

  const candidate = {
    ...presentation,
    rootDefinitions: definitions?.map((current, index) =>
      index === definitionIndex ? nextDefinition : current,
    ),
  };
  return PresentationSchema.safeParse(candidate).success ? candidate : presentation;
}

export function resolveCanonicalRootContainerId(
  presentation: Presentation,
  target: AuthoringTarget,
): string | null {
  if (!isRootDefinitionTarget(target)) return null;
  return resolveRootDefinition(presentation, target)?.root.id ?? null;
}

export function isProtectedRootContainer(
  presentation: Presentation,
  target: AuthoringTarget,
  elementId: string,
): boolean {
  return resolveCanonicalRootContainerId(presentation, target) === elementId;
}
