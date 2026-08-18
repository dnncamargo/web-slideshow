import type { Presentation } from "@powershow/document-schema";

import type { PublishedPresentationReader } from "@/features/persistence/published-presentation-reader";

export interface PresenterVersionIdentity {
  publicationId: string;
  liveVersionId: string;
  previewVersionId: string;
}

export interface LoadedPresenterVersions extends PresenterVersionIdentity {
  livePresentation: Presentation;
  previewPresentation: Presentation;
}

export interface PendingPublishedVersion {
  targetVersionId: string;
  structuralChange: boolean;
  projectedSlideRemoved: boolean;
}

export interface PresenterVersionProjection {
  presentation: Presentation;
  displayIndex: number | null;
  pendingVersion: PendingPublishedVersion | null;
}

export interface SlideVersionMapping {
  index: number;
  structuralChange: boolean;
  projectedSlideRemoved: boolean;
}

function clampIndex(index: number, slideCount: number): number {
  if (slideCount === 0) return 0;
  return Math.min(Math.max(index, 0), slideCount - 1);
}

export function canUsePointerObservation(
  observedForLiveVersionId: string,
  liveVersionId: string,
  pointerVersionId: string | null,
): boolean {
  return (
    observedForLiveVersionId === liveVersionId ||
    pointerVersionId === liveVersionId
  );
}

export function hasStructuralSlideChange(
  oldPresentation: Presentation,
  newPresentation: Presentation,
): boolean {
  if (oldPresentation.slides.length !== newPresentation.slides.length) {
    return true;
  }

  return oldPresentation.slides.some(
    (slide, index) => slide.id !== newPresentation.slides[index]?.id,
  );
}

export function mapSlideAcrossVersions(
  oldPresentation: Presentation,
  newPresentation: Presentation,
  liveIndex: number,
): SlideVersionMapping {
  const oldSlide = oldPresentation.slides[liveIndex];
  const matchingIndex = oldSlide
    ? newPresentation.slides.findIndex((slide) => slide.id === oldSlide.id)
    : -1;

  return {
    index:
      matchingIndex >= 0
        ? matchingIndex
        : clampIndex(liveIndex, newPresentation.slides.length),
    structuralChange: hasStructuralSlideChange(
      oldPresentation,
      newPresentation,
    ),
    projectedSlideRemoved: oldSlide !== undefined && matchingIndex < 0,
  };
}

/**
 * Resolve the live slide index for a canonical desired pageId against the
 * immutable Live presentation.
 *
 * Returns null when the pageId is null or absent from the Live version; the
 * Presenter must never fall back to a numeric index for an unresolved pageId.
 */
export function resolveLiveSlideIndex(
  versions: LoadedPresenterVersions,
  desiredPageId: string | null,
): number | null {
  if (desiredPageId === null) {
    return null;
  }

  const index = versions.livePresentation.slides.findIndex(
    (slide) => slide.id === desiredPageId,
  );

  return index >= 0 ? index : null;
}

export function projectPresenterVersions(
  versions: LoadedPresenterVersions,
  liveIndex: number | null,
): PresenterVersionProjection {
  if (versions.liveVersionId === versions.previewVersionId) {
    return {
      presentation: versions.previewPresentation,
      displayIndex: liveIndex,
      pendingVersion: null,
    };
  }

  const structuralChange = hasStructuralSlideChange(
    versions.livePresentation,
    versions.previewPresentation,
  );
  const mapping =
    liveIndex === null
      ? null
      : mapSlideAcrossVersions(
          versions.livePresentation,
          versions.previewPresentation,
          liveIndex,
        );

  return {
    presentation: versions.previewPresentation,
    displayIndex: mapping?.index ?? null,
    pendingVersion: {
      targetVersionId: versions.previewVersionId,
      structuralChange,
      projectedSlideRemoved: mapping?.projectedSlideRemoved ?? false,
    },
  };
}

/**
 * Loads the live and preview versions as one latest-only request. Completion
 * from an older pointer or Live identity is discarded instead of replacing a
 * newer request.
 */
export class PresenterVersionLoader {
  private requestRevision = 0;

  constructor(
    private readonly reader: Pick<PublishedPresentationReader, "getVersion">,
  ) {}

  cancel(): void {
    this.requestRevision += 1;
  }

  async load(
    identity: PresenterVersionIdentity,
  ): Promise<LoadedPresenterVersions | null> {
    const requestRevision = ++this.requestRevision;

    try {
      const livePromise = this.reader.getVersion(
        identity.publicationId,
        identity.liveVersionId,
      );
      const previewPromise =
        identity.previewVersionId === identity.liveVersionId
          ? livePromise
          : this.reader.getVersion(
              identity.publicationId,
              identity.previewVersionId,
            );
      const [livePresentation, previewPresentation] = await Promise.all([
        livePromise,
        previewPromise,
      ]);

      if (requestRevision !== this.requestRevision) {
        return null;
      }

      if (livePresentation === null || previewPresentation === null) {
        throw new Error("A published presentation version does not exist.");
      }

      return {
        ...identity,
        livePresentation,
        previewPresentation,
      };
    } catch (error) {
      if (requestRevision !== this.requestRevision) {
        return null;
      }

      throw error;
    }
  }
}
