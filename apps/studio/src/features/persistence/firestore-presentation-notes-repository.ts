import { doc, getDoc, runTransaction } from "firebase/firestore";

import { getFirebaseFirestore } from "./firebase-client";
import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import { FirestoreOperationError } from "./persistence-errors";
import {
  applySlideNote,
  createEmptyNotes,
  makeFirestoreSafeNotes,
  normalizePersistedNotes,
  type PresentationNotes,
} from "./presentation-notes";
import type { PresentationNotesRepository } from "./presentation-notes-repository";

function notesDocumentRef(userId: string, presentationId: string) {
  const firestore = getFirebaseFirestore();

  return doc(
    firestore,
    "users",
    userId,
    "presentations",
    presentationId,
    "private",
    "notes",
  );
}

/**
 * Firestore-backed private presentation notes repository.
 *
 * Notes live in a dedicated private document:
 *   users/{uid}/presentations/{presentationId}/private/notes
 *
 * Reads/writes target only this notes document and never touch the main
 * presentation document, so draftRevision, publication state, and published
 * versions remain unaffected.
 */
export class FirestorePresentationNotesRepository
  implements PresentationNotesRepository
{
  private requireAuthenticatedUser() {
    return requireAuthenticatedFirebaseUser(getCurrentNonAnonymousUser);
  }

  async getNotes(presentationId: string): Promise<PresentationNotes> {
    const user = this.requireAuthenticatedUser();
    const notesRef = notesDocumentRef(user.uid, presentationId);

    try {
      const snapshot = await getDoc(notesRef);

      if (!snapshot.exists()) {
        return createEmptyNotes();
      }

      return normalizePersistedNotes(snapshot.data());
    } catch (error) {
      console.error(`Failed to read notes for presentation "${presentationId}"`, error);

      throw new FirestoreOperationError(
        `Failed to read notes for presentation "${presentationId}".`,
        error,
      );
    }
  }

  async setSlideNote(
    presentationId: string,
    slideId: string,
    note: string,
  ): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const firestore = getFirebaseFirestore();
    const notesRef = notesDocumentRef(user.uid, presentationId);

    try {
      await runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(notesRef);
        const current = snapshot.exists()
          ? normalizePersistedNotes(snapshot.data())
          : createEmptyNotes();
        const next = applySlideNote(current, slideId, note);

        transaction.set(notesRef, makeFirestoreSafeNotes(next));
      });
    } catch (error) {
      console.error(
        `Failed to write notes for presentation "${presentationId}"`,
        error,
      );

      throw new FirestoreOperationError(
        `Failed to write notes for presentation "${presentationId}".`,
        error,
      );
    }
  }
}
