import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

export interface FirestorePresentationRecord {
  presentationJson: string;
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

  return {
    presentationJson: JSON.stringify(safe),
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
