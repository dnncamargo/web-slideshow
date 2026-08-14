import type { Presentation } from "@powershow/document-schema";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { ensureFirebaseUser } from "./firebase-anonymous-auth";
import { getFirebaseFirestore } from "./firebase-client";
import { FirestoreOperationError } from "./persistence-errors";
import {
  assertPresentationWithinSizeLimit,
  extractPresentationSummary,
  makeFirestoreSafePresentation,
  parsePersistedPresentation,
  type PresentationSummary,
} from "./presentation-persistence";
import type { PresentationRepository } from "./presentation-repository";

function presentationsCollection(
  userId: string,
): ReturnType<typeof collection> {
  const firestore = getFirebaseFirestore();

  return collection(firestore, "users", userId, "presentations");
}

function presentationDocumentRef(userId: string, presentationId: string) {
  const firestore = getFirebaseFirestore();

  return doc(firestore, "users", userId, "presentations", presentationId);
}

/**
 * Firestore-backed Presentation repository.
 *
 * One Firestore document stores the complete canonical Presentation for a
 * single user under: users/{uid}/presentations/{presentationId}
 */
export class FirestorePresentationRepository
  implements PresentationRepository
{
  async listPresentations(): Promise<PresentationSummary[]> {
    const user = await ensureFirebaseUser();
    const presentationsRef = presentationsCollection(user.uid);

    try {
      const snapshot = await getDocs(
        query(presentationsRef, orderBy("updatedAt", "desc")),
      );
      const summaries: PresentationSummary[] = [];

      for (const document of snapshot.docs) {
        const data = document.data();
        const presentation = data.presentation;

        if (
          typeof presentation !== "object" ||
          presentation === null ||
          typeof (presentation as { id?: unknown }).id !== "string" ||
          typeof (presentation as { title?: unknown }).title !== "string"
        ) {
          continue;
        }

        const archivedAt = data.archivedAt;

        if (archivedAt !== undefined && archivedAt !== null) {
          continue;
        }

        summaries.push(
          extractPresentationSummary({
            id: (presentation as { id: string }).id,
            title: (presentation as { title: string }).title,
            updatedAt: data.updatedAt,
            archivedAt: archivedAt ?? undefined,
            draftRevision: data.draftRevision,
            publication: data.publication,
          }),
        );
      }

      return summaries;
    } catch (error) {
      console.error("Failed to list presentations", error);

      throw new FirestoreOperationError(
        "Failed to list presentations.",
        error,
      );
    }
  }

  async getPresentation(id: string): Promise<Presentation | null> {
    const user = await ensureFirebaseUser();
    const documentRef = presentationDocumentRef(user.uid, id);

    try {
      const snapshot = await getDoc(documentRef);

      if (!snapshot.exists()) {
        return null;
      }

      return parsePersistedPresentation(snapshot.data());
    } catch (error) {
      console.error(`Failed to read presentation "${id}"`, error);

      throw new FirestoreOperationError(
        `Failed to read presentation "${id}".`,
        error,
      );
    }
  }

  async createPresentation(presentation: Presentation): Promise<void> {
    const user = await ensureFirebaseUser();

    assertPresentationWithinSizeLimit(presentation);

    const documentRef = presentationDocumentRef(user.uid, presentation.id);

    try {
      await setDoc(documentRef, {
        presentation: makeFirestoreSafePresentation(presentation),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        draftRevision: 1,
      });
    } catch (error) {
      console.error("Failed to create presentation", error);

      throw new FirestoreOperationError(
        "Failed to create presentation.",
        error,
      );
    }
  }

  async savePresentation(presentation: Presentation): Promise<void> {
    const user = await ensureFirebaseUser();

    assertPresentationWithinSizeLimit(presentation);

    const documentRef = presentationDocumentRef(user.uid, presentation.id);

    try {
      await updateDoc(documentRef, {
        presentation: makeFirestoreSafePresentation(presentation),
        updatedAt: serverTimestamp(),
        draftRevision: increment(1),
      });
    } catch (error) {
      console.error(`Failed to save presentation "${presentation.id}"`, error);

      throw new FirestoreOperationError(
        `Failed to save presentation "${presentation.id}".`,
        error,
      );
    }
  }

  async archivePresentation(id: string): Promise<void> {
    const user = await ensureFirebaseUser();
    const documentRef = presentationDocumentRef(user.uid, id);

    try {
      await updateDoc(documentRef, {
        archivedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Failed to archive presentation "${id}"`, error);

      throw new FirestoreOperationError(
        `Failed to archive presentation "${id}".`,
        error,
      );
    }
  }
}
