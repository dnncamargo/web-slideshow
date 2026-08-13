import type { Presentation } from "@powershow/document-schema";
import { PresentationSchema } from "@powershow/document-schema";

import {
  InvalidPersistedPresentationError,
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

export interface PresentationPersistenceEnvelope {
  presentation: Presentation;
  createdAt: unknown;
  updatedAt: unknown;
  archivedAt?: unknown;
}

export interface PresentationSummarySource {
  id: string;
  title: string;
  updatedAt: unknown;
  archivedAt?: unknown;
}

export interface PresentationSummary {
  id: string;
  title: string;
  updatedAt: unknown;
  archived: boolean;
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

  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updatedAt,
    archived: archivedAt !== undefined && archivedAt !== null,
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
