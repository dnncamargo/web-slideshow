import type { Presentation } from "@powershow/document-schema";
import { PresentationSchema } from "@powershow/document-schema";

import {
  InvalidPersistedPresentationError,
  PresentationTooDeepError,
  PresentationTooLargeError,
} from "./persistence-errors";

/**
 * Application-level safety threshold for a single persisted Presentation.
 *
 * This is an APPLICATION SAFETY ESTIMATE (UTF-8 JSON byte length), not an exact
 * Firestore wire-size calculation. It deliberately leaves comfortable overhead
 * below Firestore's hard document-size limit.
 */
export const MAX_PRESENTATION_SAFE_BYTES = 800 * 1024;
export const MAX_FIRESTORE_NESTING_DEPTH = 20;

export interface PresentationPersistenceEnvelope {
  presentation: Presentation;
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
  draftRevision?: unknown;
  publication?: unknown;
}

export interface PresentationSummary {
  id: string;
  title: string;
  updatedAt: unknown;
  archived: boolean;
  publicationState: PresentationPublicationState;
  draftRevision: number;
  publication: PresentationPublicationMetadata | undefined;
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
  presentation: Presentation;
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

function toFirestoreSafeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map(toFirestoreSafeValue)
      .filter((entry) => entry !== undefined);
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const sanitized = toFirestoreSafeValue(entryValue);

      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }

    return output;
  }

  return value;
}

function isStructuralValue(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

/**
 * Convert a canonical Presentation to a Firestore-safe structured plain value.
 *
 * Firestore rejects arbitrary undefined property values on nested objects, so
 * undefined object properties are omitted while the source object is never
 * mutated. Order within arrays is preserved.
 */
export function makeFirestoreSafePresentation(
  presentation: Presentation,
): Record<string, unknown> {
  return toFirestoreSafeValue(presentation) as Record<string, unknown>;
}

/**
 * Estimate the maximum Firestore structural nesting depth of a plain value.
 *
 * Scalars do not add structural depth. Objects and arrays each add one level.
 * The returned depth is measured from the root value, so a root object or
 * array with only scalar descendants has depth 1.
 */
export function estimateFirestoreNestingDepth(value: unknown): number {
  if (!isStructuralValue(value)) {
    return 0;
  }

  const entries = Array.isArray(value) ? value : Object.values(value);
  let maxDepth = 1;

  for (const entry of entries) {
    maxDepth = Math.max(maxDepth, 1 + estimateFirestoreNestingDepth(entry));
  }

  return maxDepth;
}

export function assertPresentationWithinFirestoreNestingDepth(
  value: unknown,
  limitDepth: number = MAX_FIRESTORE_NESTING_DEPTH,
): void {
  const actualDepth = estimateFirestoreNestingDepth(value);

  if (actualDepth > limitDepth) {
    throw new PresentationTooDeepError(actualDepth, limitDepth);
  }
}

/**
 * Deterministic UTF-8 byte estimate of the serialized Presentation.
 * See MAX_PRESENTATION_SAFE_BYTES for the documented caveat.
 */
export function estimatePresentationBytes(
  presentation: Presentation,
): number {
  const json = JSON.stringify(makeFirestoreSafePresentation(presentation));

  return new TextEncoder().encode(json).byteLength;
}

export function assertPresentationWithinSizeLimit(
  presentation: Presentation,
  limitBytes: number = MAX_PRESENTATION_SAFE_BYTES,
): void {
  const actualBytes = estimatePresentationBytes(presentation);

  if (actualBytes > limitBytes) {
    throw new PresentationTooLargeError(actualBytes, limitBytes);
  }
}

export function extractPresentationSummary(
  data: PresentationSummarySource,
): PresentationSummary {
  const archivedAt = data.archivedAt;
  const metadata = normalizePersistenceMetadata(
    data.draftRevision,
    data.publication,
  );

  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updatedAt,
    archived: archivedAt !== undefined && archivedAt !== null,
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
  const candidate =
    typeof persisted === "object" && persisted !== null
      ? (persisted as { presentation?: unknown }).presentation
      : undefined;
  const result = PresentationSchema.safeParse(candidate);

  if (!result.success) {
    throw new InvalidPersistedPresentationError(
      "Persisted presentation is not a valid PowerShow document.",
      result.error,
    );
  }

  return result.data;
}
