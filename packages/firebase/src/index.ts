import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

export interface FirestorePresentationRecord {
  presentationJson: string;
}

export const MAX_PRESENTATION_SAFE_BYTES = 800 * 1024;

export class PresentationTooLargeError extends Error {
  readonly actualBytes: number;

  readonly limitBytes: number;

  constructor(actualBytes: number, limitBytes: number = MAX_PRESENTATION_SAFE_BYTES) {
    super(
      `Presentation is too large to persist safely: ${actualBytes} bytes exceeds the ${limitBytes} byte limit.`,
    );
    this.name = "PresentationTooLargeError";
    this.actualBytes = actualBytes;
    this.limitBytes = limitBytes;
  }
}

export class PresentationIdentityError extends Error {
  constructor(expectedId: string, actualId: string) {
    super(
      `Presentation identity mismatch: expected "${expectedId}", received "${actualId}".`,
    );
    this.name = "PresentationIdentityError";
  }
}

export function assertPresentationId(
  presentation: Presentation,
  expectedId: string,
): Presentation {
  if (presentation.id !== expectedId) {
    throw new PresentationIdentityError(expectedId, presentation.id);
  }

  return presentation;
}

function toFirestoreSafeValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map(toFirestoreSafeValue)
      .filter((entry) => entry !== undefined);
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = toFirestoreSafeValue(entryValue);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }

    return output;
  }

  return value;
}

export function encodePresentationForFirestore(
  presentation: Presentation,
): FirestorePresentationRecord {
  const parsed = PresentationSchema.parse(presentation);
  const safe = toFirestoreSafeValue(parsed);
  const presentationJson = JSON.stringify(safe);
  const actualBytes = new TextEncoder().encode(presentationJson).byteLength;

  if (actualBytes > MAX_PRESENTATION_SAFE_BYTES) {
    throw new PresentationTooLargeError(actualBytes);
  }

  return {
    presentationJson,
  };
}

export function decodePresentationFromFirestore(
  record: unknown,
): Presentation {
  if (typeof record !== "object" || record === null) {
    throw new Error("Firestore presentation record must be an object.");
  }

  const candidate = record as Record<string, unknown>;
  if (
    typeof candidate.presentationJson !== "string" ||
    candidate.presentationJson.length === 0
  ) {
    throw new Error("Firestore presentation record requires presentationJson.");
  }

  const actualBytes = new TextEncoder().encode(candidate.presentationJson).byteLength;
  if (actualBytes > MAX_PRESENTATION_SAFE_BYTES) {
    throw new PresentationTooLargeError(actualBytes);
  }

  return PresentationSchema.parse(
    parsePresentationJsonForRecovery(candidate.presentationJson),
  );
}

/** Parse the encoded payload for the explicit draft-recovery workflow. */
export function parsePresentationJsonForRecovery(value: unknown): unknown {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Firestore presentation record requires presentationJson.");
  }

  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error("Firestore presentationJson is not valid JSON.", { cause: error });
  }
}
