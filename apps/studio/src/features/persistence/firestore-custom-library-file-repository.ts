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
  CustomLibraryFileDraft,
  CustomLibraryFileRecord,
} from "../custom-library/custom-library-file";
import { parseCustomLibraryFileDraft } from "../custom-library/custom-library-file-schema";
import type { CustomLibraryFileRepository } from "../custom-library/custom-library-file-repository";
import {
  assertStableAssetDocumentId,
  canonicalValuesEqual,
  type StablePersistenceOptions,
} from "./firestore-idempotency";
import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseFirestore } from "./firebase-client";
import {
  FirestoreOperationError,
  InvalidCustomLibraryFileForPersistenceError,
  InvalidPersistedCustomLibraryFileError,
} from "./persistence-errors";

function customLibraryFilesCollection(userId: string): ReturnType<typeof collection> {
  return collection(getFirebaseFirestore(), "users", userId, "customLibraryFiles");
}

function customLibraryFileDocumentRef(userId: string, fileId: string) {
  return doc(getFirebaseFirestore(), "users", userId, "customLibraryFiles", fileId);
}

export class FirestoreCustomLibraryFileRepository implements CustomLibraryFileRepository {
  private requireAuthenticatedUser() {
    return requireAuthenticatedFirebaseUser(getCurrentNonAnonymousUser);
  }

  async saveFile(
    file: CustomLibraryFileDraft,
    options: StablePersistenceOptions = {},
  ): Promise<string> {
    const user = this.requireAuthenticatedUser();
    let validatedFile: CustomLibraryFileDraft;

    try {
      validatedFile = parseCustomLibraryFileDraft(file);
    } catch (error) {
      throw new InvalidCustomLibraryFileForPersistenceError(
        "Custom Library file is invalid for persistence.",
        error,
      );
    }

    if (options.documentId !== undefined) {
      assertStableAssetDocumentId(options.documentId);
      if (options.documentId !== validatedFile.source.assetId) {
        throw new FirestoreOperationError("Stable file identity does not match the managed asset.");
      }
    }

    const documentRef = options.documentId
      ? customLibraryFileDocumentRef(user.uid, options.documentId)
      : doc(customLibraryFilesCollection(user.uid));

    if (options.documentId === undefined) {
      try {
        await setDoc(documentRef, validatedFile);
      } catch (error) {
        console.error("Failed to save Custom Library file.", error);
        throw new FirestoreOperationError("Failed to save Custom Library file.", error);
      }

      return documentRef.id;
    }

    try {
      await runTransaction(getFirebaseFirestore(), async (transaction) => {
        const snapshot = await transaction.get(documentRef);
        if (snapshot.exists()) {
          let existingFile: CustomLibraryFileDraft;
          try {
            existingFile = parseCustomLibraryFileDraft(snapshot.data());
          } catch (error) {
            throw new InvalidPersistedCustomLibraryFileError(
              `Persisted Custom Library file "${documentRef.id}" is invalid.`,
              error,
            );
          }

          if (!canonicalValuesEqual(existingFile, validatedFile)) {
            throw new FirestoreOperationError(
              "Stable Custom Library file identity conflicts with existing data.",
            );
          }

          return;
        }

        transaction.set(documentRef, validatedFile);
      });
    } catch (error) {
      if (
        error instanceof InvalidPersistedCustomLibraryFileError ||
        error instanceof FirestoreOperationError
      ) {
        throw error;
      }
      console.error("Failed to save Custom Library file.", error);
      throw new FirestoreOperationError("Failed to save Custom Library file.", error);
    }

    return documentRef.id;
  }

  async updateFile(id: string, file: CustomLibraryFileDraft): Promise<void> {
    const user = this.requireAuthenticatedUser();
    let validatedFile: CustomLibraryFileDraft;

    try {
      validatedFile = parseCustomLibraryFileDraft(file);
    } catch (error) {
      throw new InvalidCustomLibraryFileForPersistenceError(
        "Custom Library file is invalid for persistence.",
        error,
      );
    }

    const documentRef = customLibraryFileDocumentRef(user.uid, id);
    let snapshot: Awaited<ReturnType<typeof getDoc>>;

    try {
      snapshot = await getDoc(documentRef);
    } catch (error) {
      console.error(`Failed to update Custom Library file "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to update Custom Library file "${id}".`,
        error,
      );
    }

    if (!snapshot.exists()) {
      throw new FirestoreOperationError(
        `Failed to update Custom Library file "${id}": file does not exist.`,
      );
    }

    try {
      await setDoc(documentRef, validatedFile);
    } catch (error) {
      console.error(`Failed to update Custom Library file "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to update Custom Library file "${id}".`,
        error,
      );
    }
  }

  async listFiles(): Promise<CustomLibraryFileRecord[]> {
    const user = this.requireAuthenticatedUser();
    let snapshot: Awaited<ReturnType<typeof getDocs>>;

    try {
      snapshot = await getDocs(customLibraryFilesCollection(user.uid));
    } catch (error) {
      console.error("Failed to list Custom Library files.", error);
      throw new FirestoreOperationError("Failed to list Custom Library files.", error);
    }

    return snapshot.docs.map((document) => {
      try {
        return { id: document.id, file: parseCustomLibraryFileDraft(document.data()) };
      } catch (error) {
        throw new InvalidPersistedCustomLibraryFileError(
          `Persisted Custom Library file "${document.id}" is invalid.`,
          error,
        );
      }
    });
  }

  async getFile(id: string): Promise<CustomLibraryFileRecord | null> {
    const user = this.requireAuthenticatedUser();
    const documentRef = customLibraryFileDocumentRef(user.uid, id);
    let snapshot: Awaited<ReturnType<typeof getDoc>>;

    try {
      snapshot = await getDoc(documentRef);
    } catch (error) {
      console.error(`Failed to load Custom Library file "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to load Custom Library file "${id}".`,
        error,
      );
    }

    if (!snapshot.exists()) {
      return null;
    }

    try {
      return { id: snapshot.id, file: parseCustomLibraryFileDraft(snapshot.data()) };
    } catch (error) {
      throw new InvalidPersistedCustomLibraryFileError(
        `Persisted Custom Library file "${snapshot.id}" is invalid.`,
        error,
      );
    }
  }

  async deleteFile(id: string): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const documentRef = customLibraryFileDocumentRef(user.uid, id);

    try {
      await deleteDoc(documentRef);
    } catch (error) {
      console.error(`Failed to delete Custom Library file "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to delete Custom Library file "${id}".`,
        error,
      );
    }
  }
}
