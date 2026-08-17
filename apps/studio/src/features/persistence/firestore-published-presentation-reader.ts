import { doc, getDoc, onSnapshot } from "firebase/firestore";

import type { Presentation } from "@powershow/document-schema";

import { getFirebaseFirestore } from "./firebase-client";
import { FirestoreOperationError } from "./persistence-errors";
import { parsePersistedPresentation } from "./presentation-persistence";
import type {
  PublishedPresentationPointer,
  PublishedPresentationReader,
} from "./published-presentation-reader";

function publishedPointerRef(publicationId: string) {
  return doc(
    getFirebaseFirestore(),
    "publishedPresentations",
    publicationId,
  );
}

function publishedVersionRef(publicationId: string, versionId: string) {
  const firestore = getFirebaseFirestore();

  return doc(
    firestore,
    "publishedPresentations",
    publicationId,
    "versions",
    versionId,
  );
}

function parsePublishedPointer(value: unknown): PublishedPresentationPointer {
  if (typeof value !== "object" || value === null) {
    throw new Error("Published presentation pointer must be an object.");
  }

  const record = value as Record<string, unknown>;
  const currentVersionId = record.currentVersionId;
  const publishedRevision = record.publishedRevision;

  if (
    typeof currentVersionId !== "string" ||
    currentVersionId.trim() === ""
  ) {
    throw new Error(
      "Published presentation pointer requires a currentVersionId.",
    );
  }

  if (
    typeof publishedRevision !== "number" ||
    !Number.isInteger(publishedRevision) ||
    publishedRevision < 0
  ) {
    throw new Error(
      "Published presentation pointer requires a non-negative publishedRevision.",
    );
  }

  return {
    currentVersionId: currentVersionId.trim(),
    publishedRevision,
  };
}

function pointerOperationError(
  publicationId: string,
  cause: unknown,
): FirestoreOperationError {
  console.error(
    `Failed to observe published presentation "${publicationId}"`,
    cause,
  );

  return new FirestoreOperationError(
    `Failed to observe published presentation "${publicationId}".`,
    cause,
  );
}

/**
 * Firestore-backed read-only published version reader.
 *
 * Reads exactly:
 *   publishedPresentations/{publicationId}/versions/{versionId}
 *
 * The stored Presentation is validated through the same canonical
 * @powershow/document-schema validation path used for drafts, so malformed
 * persisted data is never returned as a valid Presentation.
 */
export class FirestorePublishedPresentationReader
  implements PublishedPresentationReader
{
  subscribePointer(
    publicationId: string,
    onPointer: (pointer: PublishedPresentationPointer | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    try {
      return onSnapshot(
        publishedPointerRef(publicationId),
        (snapshot) => {
          if (!snapshot.exists()) {
            onPointer(null);
            return;
          }

          let pointer: PublishedPresentationPointer;
          try {
            pointer = parsePublishedPointer(snapshot.data());
          } catch (error) {
            onError(pointerOperationError(publicationId, error));
            return;
          }

          onPointer(pointer);
        },
        (error) => {
          onError(pointerOperationError(publicationId, error));
        },
      );
    } catch (error) {
      onError(pointerOperationError(publicationId, error));
      return () => undefined;
    }
  }

  async getVersion(
    publicationId: string,
    versionId: string,
  ): Promise<Presentation | null> {
    const versionRef = publishedVersionRef(publicationId, versionId);

    try {
      const snapshot = await getDoc(versionRef);

      if (!snapshot.exists()) {
        return null;
      }

      return parsePersistedPresentation(snapshot.data());
    } catch (error) {
      console.error(
        `Failed to read published version "${versionId}"`,
        error,
      );

      throw new FirestoreOperationError(
        `Failed to read published version "${versionId}".`,
        error,
      );
    }
  }
}
