import type { Presentation, Slide } from "@powershow/document-schema";
import { PresentationSchema } from "@powershow/document-schema";
import {
  decodePresentationFromFirestore,
  encodePresentationForFirestore,
} from "@powershow/firebase";

export { MAX_PRESENTATION_SAFE_BYTES } from "@powershow/firebase";

import {
  InvalidPersistedPresentationError,
  InvalidPresentationForPersistenceError,
} from "./persistence-errors";

/**
 * Application-level safety threshold for a single persisted Presentation.
 *
 * This is an APPLICATION SAFETY ESTIMATE (UTF-8 JSON byte length), not an exact
 * Firestore wire-size calculation. It deliberately leaves comfortable overhead
 * below Firestore's hard document-size limit.
 */
export interface PresentationPersistenceEnvelope {
  presentationJson: string;
  createdAt: unknown;
  updatedAt: unknown;
  archivedAt?: unknown;
  draftRevision?: unknown;
  publication?: unknown;
}

export interface PresentationSummarySource {
  id: string;
  title: string;
  updatedAt: unknown;
  archivedAt?: unknown;
  folderId?: unknown;
  draftRevision?: unknown;
  publication?: unknown;
}

export interface PresentationSummary {
  id: string;
  title: string;
  updatedAt: unknown;
  archived: boolean;
  archivedAt: unknown | null;
  folderId: string | null;
  publicationState: PresentationPublicationState;
  draftRevision: number;
  publication: PresentationPublicationMetadata | undefined;
  thumbnailPreview?: PresentationThumbnailPreview;
}

/**
 * Transient Library preview projection.
 *
 * It holds only what the Library needs to render the FIRST slide of a
 * presentation and is derived from the already-read persisted Presentation.
 * It is never written back to Firestore and carries no thumbnail blob,
 * base64, or generated image.
 */
export interface PresentationThumbnailPreview {
  aspectRatio: "16:9" | "4:3";
  firstSlide: Slide;
  presentation: Presentation;
}

/**
 * Publication metadata contract. Not written in Round 4A; Round 4B populates
 * it. Every field identifies the immutable published snapshot and the draft
 * revision it was produced from.
 */
export interface PresentationPublicationMetadata {
  publicationId: string;
  currentVersionId: string;
  publishedRevision: number;
  publishedAt: unknown;
}

export interface PublishedPresentationVersion {
  presentationId: string;
  presentationJson: string;
  publishedRevision: number;
  publishedAt: unknown;
}

export type PresentationPublicationState =
  | "draft"
  | "published"
  | "unpublished-changes";

function isValidRevision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function normalizeDraftRevision(value: unknown): number {
  return isValidRevision(value) ? value : 0;
}

/**
 * Normalize private Studio organization metadata into a stable, safe value.
 *
 * folderId is a private Studio field stored at the top level of the draft
 * document, beside the canonical Presentation. Malformed, non-string, empty,
 * or whitespace-only values are normalized to null so they can never
 * invalidate an otherwise valid presentation summary. A valid non-empty string
 * is returned unchanged; it is never trimmed.
 */
export function normalizeFolderId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizePublicationMetadata(value: unknown): PresentationPublicationMetadata | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.publicationId !== "string" ||
    !candidate.publicationId ||
    typeof candidate.currentVersionId !== "string" ||
    !candidate.currentVersionId ||
    !isValidRevision(candidate.publishedRevision) ||
    !("publishedAt" in candidate)
  ) {
    return undefined;
  }

  return {
    publicationId: candidate.publicationId,
    currentVersionId: candidate.currentVersionId,
    publishedRevision: candidate.publishedRevision,
    publishedAt: candidate.publishedAt,
  };
}

export function normalizePersistenceMetadata(
  draftRevision: unknown,
  publication: unknown,
): { draftRevision: number; publication: PresentationPublicationMetadata | undefined } {
  return {
    draftRevision: normalizeDraftRevision(draftRevision),
    publication: normalizePublicationMetadata(publication),
  };
}

export function resolvePublicationState(
  draftRevision: number,
  publication: PresentationPublicationMetadata | undefined,
): PresentationPublicationState {
  if (!publication) {
    return "draft";
  }

  if (publication.publishedRevision === draftRevision) {
    return "published";
  }

  return "unpublished-changes";
}

/**
 * Validate runtime Studio state immediately before it crosses the Firestore
 * write boundary. The TypeScript Presentation type cannot protect this path
 * from invalid state produced by runtime mutations.
 */
export function assertValidPresentationForPersistence(
  presentation: Presentation,
): void {
  const result = PresentationSchema.safeParse(presentation);

  if (!result.success) {
    throw new InvalidPresentationForPersistenceError(
      "Presentation is not a valid PowerShow document and cannot be persisted.",
      result.error,
    );
  }
}

/**
 * Deterministic UTF-8 byte estimate of the serialized Presentation.
 * See MAX_PRESENTATION_SAFE_BYTES for the documented caveat.
 */
export function estimatePresentationBytes(
  presentation: Presentation,
): number {
  return new TextEncoder().encode(
    encodePresentationForFirestore(presentation).presentationJson,
  ).byteLength;
}

export function extractPresentationSummary(
  data: PresentationSummarySource,
): PresentationSummary {
  const archivedAt = data.archivedAt;
  const normalizedArchivedAt = archivedAt === undefined ? null : archivedAt;
  const metadata = normalizePersistenceMetadata(
    data.draftRevision,
    data.publication,
  );

  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updatedAt,
    archived: normalizedArchivedAt !== null,
    archivedAt: normalizedArchivedAt,
    folderId: normalizeFolderId(data.folderId),
    publicationState: resolvePublicationState(
      metadata.draftRevision,
      metadata.publication,
    ),
    draftRevision: metadata.draftRevision,
    publication: metadata.publication,
  };
}

/**
 * Validate an externally persisted Presentation before returning it to the
 * Studio. Never blindly casts persisted data to the canonical type.
 */
export function parsePersistedPresentation(
  persisted: unknown,
): Presentation {
  try {
    return decodePresentationFromFirestore(persisted);
  } catch (error) {
    throw new InvalidPersistedPresentationError(
      "Persisted presentation is not a valid PowerShow document.",
      error,
    );
  }
}

/**
 * Safely derive a Library thumbnail preview from the already-decoded canonical
 * presentation value.
 *
 * Returns undefined when the first slide has no authored elements OR when the
 * data cannot be safely projected — the caller falls back to the decorative
 * thumbnail.
 */
export function deriveThumbnailPreview(
  rawPresentation: unknown,
): PresentationThumbnailPreview | undefined {
  if (
    typeof rawPresentation !== "object" ||
    rawPresentation === null
  ) {
    return undefined;
  }

  const pres = rawPresentation as Record<string, unknown>;

  const slides = Array.isArray(pres.slides) ? pres.slides : [];

  if (slides.length === 0) {
    return undefined;
  }

  const firstSlideCandidate = slides[0];

  if (
    typeof firstSlideCandidate !== "object" ||
    firstSlideCandidate === null
  ) {
    return undefined;
  }

  const elementsValue = (firstSlideCandidate as Record<string, unknown>)
    .elements;

  // Blank-slide rule: preserve the decorative fallback even when the slide has
  // a configured background.
  if (!Array.isArray(elementsValue) || elementsValue.length === 0) {
    return undefined;
  }

  const parsed = PresentationSchema.safeParse({
    ...pres,
    slides: [firstSlideCandidate],
  });

  if (!parsed.success) {
    return undefined;
  }

  const firstSlide = parsed.data.slides[0];

  if (!firstSlide) {
    return undefined;
  }

  return {
    aspectRatio: parsed.data.aspectRatio,
    firstSlide,
    presentation: parsed.data,
  };
}
