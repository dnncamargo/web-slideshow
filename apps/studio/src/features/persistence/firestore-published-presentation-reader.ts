import { doc, getDoc } from "firebase/firestore";

import type { Presentation } from "@powershow/document-schema";

import { getFirebaseFirestore } from "./firebase-client";
import { FirestoreOperationError } from "./persistence-errors";
import { parsePersistedPresentation } from "./presentation-persistence";
import type { PublishedPresentationReader } from "./published-presentation-reader";

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
