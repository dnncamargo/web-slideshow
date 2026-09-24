import {
  PresentationSchema,
  findRootDefinitionContainers,
  type Presentation,
  type PresentationElement,
  type Slide,
} from "@web-slideshow/document-schema";

import { findElementById, updateElementById } from "./element-hierarchy";

export type LocalRootChildOwner = Readonly<{
  targetContainerId: string;
  recordIndex: number;
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
