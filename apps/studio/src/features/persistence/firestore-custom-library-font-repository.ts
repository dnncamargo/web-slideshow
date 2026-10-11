import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
} from "firebase/firestore";

import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import type {
  CustomLibraryFontDraft,
  CustomLibraryFontRecord,
} from "../custom-library/custom-library-font";
import { parseCustomLibraryFontDraft } from "../custom-library/custom-library-font-schema";
import type { CustomLibraryFontRepository } from "../custom-library/custom-library-font-repository";
import {
  assertStableAssetDocumentId,
  canonicalValuesEqual,
  type StablePersistenceOptions,
} from "./firestore-idempotency";
import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseFirestore } from "./firebase-client";
import {
  FirestoreOperationError,
  InvalidCustomLibraryFontForPersistenceError,
  InvalidPersistedCustomLibraryFontError,
} from "./persistence-errors";

function customLibraryFontsCollection(userId: string): ReturnType<typeof collection> {
  return collection(getFirebaseFirestore(), "users", userId, "customLibraryFonts");
}

function customLibraryFontDocumentRef(userId: string, fontId: string) {
  return doc(
    getFirebaseFirestore(),
    "users",
    userId,
    "customLibraryFonts",
    fontId,
  );
}

export class FirestoreCustomLibraryFontRepository implements CustomLibraryFontRepository {
  private requireAuthenticatedUser() {
    return requireAuthenticatedFirebaseUser(getCurrentNonAnonymousUser);
  }

  async saveFont(
    font: CustomLibraryFontDraft,
    options: StablePersistenceOptions = {},
  ): Promise<string> {
    const user = this.requireAuthenticatedUser();
    let validatedFont: CustomLibraryFontDraft;

    try {
      validatedFont = parseCustomLibraryFontDraft(font);
    } catch (error) {
      throw new InvalidCustomLibraryFontForPersistenceError(
        "Custom Library font is invalid for persistence.",
        error,
      );
    }

    if (options.documentId !== undefined) assertStableAssetDocumentId(options.documentId);

    const documentRef = options.documentId
      ? customLibraryFontDocumentRef(user.uid, options.documentId)
      : doc(customLibraryFontsCollection(user.uid));

    if (options.documentId === undefined) {
      try {
        await setDoc(documentRef, validatedFont);
      } catch (error) {
        console.error("Failed to save Custom Library font.", error);
        throw new FirestoreOperationError("Failed to save Custom Library font.", error);
      }

      return documentRef.id;
    }

    try {
      await runTransaction(getFirebaseFirestore(), async (transaction) => {
        const snapshot = await transaction.get(documentRef);
        if (snapshot.exists()) {
          let existingFont: CustomLibraryFontDraft;
          try {
            existingFont = parseCustomLibraryFontDraft(snapshot.data());
          } catch (error) {
            throw new InvalidPersistedCustomLibraryFontError(
              `Persisted Custom Library font "${documentRef.id}" is invalid.`,
              error,
            );
          }

          if (!canonicalValuesEqual(existingFont, validatedFont)) {
            throw new FirestoreOperationError(
              "Stable Custom Library font identity conflicts with existing data.",
            );
          }

          return;
        }

        transaction.set(documentRef, validatedFont);
      });
    } catch (error) {
      if (
        error instanceof InvalidPersistedCustomLibraryFontError ||
        error instanceof FirestoreOperationError
      ) {
        throw error;
      }
      console.error("Failed to save Custom Library font.", error);
      throw new FirestoreOperationError("Failed to save Custom Library font.", error);
    }

    return documentRef.id;
  }

  async updateFont(id: string, font: CustomLibraryFontDraft): Promise<void> {
    const user = this.requireAuthenticatedUser();
    let validatedFont: CustomLibraryFontDraft;

    try {
      validatedFont = parseCustomLibraryFontDraft(font);
    } catch (error) {
      throw new InvalidCustomLibraryFontForPersistenceError(
        "Custom Library font is invalid for persistence.",
        error,
      );
    }

    const documentRef = customLibraryFontDocumentRef(user.uid, id);
    let snapshot: Awaited<ReturnType<typeof getDoc>>;

    try {
      snapshot = await getDoc(documentRef);
    } catch (error) {
      console.error(`Failed to update Custom Library font "${id}".`, error);
      throw new FirestoreOperationError(`Failed to update Custom Library font "${id}".`, error);
    }

    if (!snapshot.exists()) {
      throw new FirestoreOperationError(
        `Failed to update Custom Library font "${id}": font does not exist.`,
      );
    }

    try {
      await setDoc(documentRef, validatedFont);
    } catch (error) {
      console.error(`Failed to update Custom Library font "${id}".`, error);
      throw new FirestoreOperationError(`Failed to update Custom Library font "${id}".`, error);
    }
  }

  async listFonts(): Promise<CustomLibraryFontRecord[]> {
    const user = this.requireAuthenticatedUser();
    let snapshot: Awaited<ReturnType<typeof getDocs>>;

    try {
      snapshot = await getDocs(customLibraryFontsCollection(user.uid));
    } catch (error) {
      console.error("Failed to list Custom Library fonts.", error);
      throw new FirestoreOperationError("Failed to list Custom Library fonts.", error);
    }

    return snapshot.docs.map((document) => {
      try {
        return { id: document.id, font: parseCustomLibraryFontDraft(document.data()) };
      } catch (error) {
        throw new InvalidPersistedCustomLibraryFontError(
          `Persisted Custom Library font "${document.id}" is invalid.`,
          error,
        );
      }
    });
  }

  async getFont(id: string): Promise<CustomLibraryFontRecord | null> {
    const user = this.requireAuthenticatedUser();
    const documentRef = customLibraryFontDocumentRef(user.uid, id);
    let snapshot: Awaited<ReturnType<typeof getDoc>>;

    try {
      snapshot = await getDoc(documentRef);
    } catch (error) {
      console.error(`Failed to load Custom Library font "${id}".`, error);
      throw new FirestoreOperationError(`Failed to load Custom Library font "${id}".`, error);
    }

    if (!snapshot.exists()) return null;

    try {
      return { id: snapshot.id, font: parseCustomLibraryFontDraft(snapshot.data()) };
    } catch (error) {
      throw new InvalidPersistedCustomLibraryFontError(
        `Persisted Custom Library font "${snapshot.id}" is invalid.`,
        error,
      );
    }
  }

  async deleteFont(id: string): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const documentRef = customLibraryFontDocumentRef(user.uid, id);

    try {
      await deleteDoc(documentRef);
    } catch (error) {
      console.error(`Failed to delete Custom Library font "${id}".`, error);
      throw new FirestoreOperationError(`Failed to delete Custom Library font "${id}".`, error);
    }
  }
}
