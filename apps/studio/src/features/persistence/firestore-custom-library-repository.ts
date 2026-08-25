import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import type { CustomLibraryItemDraft } from "../custom-library/custom-library-item";
import { parseCustomLibraryItemDraft } from "../custom-library/custom-library-schema";
import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../custom-library/custom-library-repository";
import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseFirestore } from "./firebase-client";
import {
  FirestoreOperationError,
  InvalidCustomLibraryItemForPersistenceError,
  InvalidPersistedCustomLibraryItemError,
} from "./persistence-errors";

function customLibraryItemsCollection(userId: string): ReturnType<typeof collection> {
  return collection(getFirebaseFirestore(), "users", userId, "customLibraryItems");
}

function customLibraryItemDocumentRef(userId: string, itemId: string) {
  return doc(
    getFirebaseFirestore(),
    "users",
    userId,
    "customLibraryItems",
    itemId,
  );
}

export class FirestoreCustomLibraryRepository implements CustomLibraryRepository {
  private requireAuthenticatedUser() {
    return requireAuthenticatedFirebaseUser(getCurrentNonAnonymousUser);
  }

  async saveItem(item: CustomLibraryItemDraft): Promise<string> {
    const user = this.requireAuthenticatedUser();
    let validatedItem: CustomLibraryItemDraft;

    try {
      validatedItem = parseCustomLibraryItemDraft(item);
    } catch (error) {
      throw new InvalidCustomLibraryItemForPersistenceError(
        "Custom Library item is invalid for persistence.",
        error,
      );
    }

    const documentRef = doc(customLibraryItemsCollection(user.uid));

    try {
      await setDoc(documentRef, validatedItem);
    } catch (error) {
      console.error("Failed to save Custom Library item.", error);
      throw new FirestoreOperationError(
        "Failed to save Custom Library item.",
        error,
      );
    }

    return documentRef.id;
  }

  async listItems(): Promise<CustomLibraryItemRecord[]> {
    const user = this.requireAuthenticatedUser();
    let snapshot: Awaited<ReturnType<typeof getDocs>>;

    try {
      snapshot = await getDocs(customLibraryItemsCollection(user.uid));
    } catch (error) {
      console.error("Failed to list Custom Library items.", error);
      throw new FirestoreOperationError(
        "Failed to list Custom Library items.",
        error,
      );
    }

    return snapshot.docs.map((document) => {
      try {
        return {
          id: document.id,
          item: parseCustomLibraryItemDraft(document.data()),
        };
      } catch (error) {
        throw new InvalidPersistedCustomLibraryItemError(
          `Persisted Custom Library item "${document.id}" is invalid.`,
          error,
        );
      }
    });
  }

  async getItem(id: string): Promise<CustomLibraryItemRecord | null> {
    const user = this.requireAuthenticatedUser();
    const documentRef = customLibraryItemDocumentRef(user.uid, id);
    let snapshot: Awaited<ReturnType<typeof getDoc>>;

    try {
      snapshot = await getDoc(documentRef);
    } catch (error) {
      console.error(`Failed to load Custom Library item "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to load Custom Library item "${id}".`,
        error,
      );
    }

    if (!snapshot.exists()) {
      return null;
    }

    try {
      return {
        id: snapshot.id,
        item: parseCustomLibraryItemDraft(snapshot.data()),
      };
    } catch (error) {
      throw new InvalidPersistedCustomLibraryItemError(
        `Persisted Custom Library item "${snapshot.id}" is invalid.`,
        error,
      );
    }
  }

  async deleteItem(id: string): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const documentRef = customLibraryItemDocumentRef(user.uid, id);

    try {
      await deleteDoc(documentRef);
    } catch (error) {
      console.error(`Failed to delete Custom Library item "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to delete Custom Library item "${id}".`,
        error,
      );
    }
  }
}
