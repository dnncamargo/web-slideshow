import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { getFirebaseFirestore } from "./firebase-client";
import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import {
  FirestoreOperationError,
  InvalidFolderNameError,
} from "./persistence-errors";
import {
  MAX_FOLDER_NAME_LENGTH,
  isValidFolderName,
  normalizeFolderName,
  type PresentationFolder,
} from "./presentation-folder";
import type { PresentationFolderRepository } from "./presentation-folder-repository";

function foldersCollection(userId: string): ReturnType<typeof collection> {
  const firestore = getFirebaseFirestore();

  return collection(firestore, "users", userId, "presentationFolders");
}

function folderDocumentRef(userId: string, folderId: string) {
  const firestore = getFirebaseFirestore();

  return doc(firestore, "users", userId, "presentationFolders", folderId);
}

/**
 * Firestore-backed private presentation-folder repository.
 *
 * Folders live at: users/{uid}/presentationFolders/{folderId}
 *
 * Each folder document stores only its display name and creation/update
 * timestamps. Folders are flat in V1: no parentId and no nesting.
 */
export class FirestorePresentationFolderRepository
  implements PresentationFolderRepository
{
  private requireAuthenticatedUser() {
    return requireAuthenticatedFirebaseUser(getCurrentNonAnonymousUser);
  }

  async listFolders(): Promise<PresentationFolder[]> {
    const user = this.requireAuthenticatedUser();

    try {
      const snapshot = await getDocs(
        query(foldersCollection(user.uid), orderBy("createdAt", "asc")),
      );
      const folders: PresentationFolder[] = [];

      for (const document of snapshot.docs) {
        const data = document.data();
        const name = data.name;

        if (
          typeof name !== "string" ||
          normalizeFolderName(name).length === 0
        ) {
          continue;
        }

        folders.push({
          id: document.id,
          name,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }

      return folders;
    } catch (error) {
      console.error("Failed to list presentation folders", error);

      throw new FirestoreOperationError(
        "Failed to list presentation folders.",
        error,
      );
    }
  }

  async createFolder(name: string): Promise<string> {
    const user = this.requireAuthenticatedUser();
    this.assertValidFolderName(name);

    const documentRef = doc(foldersCollection(user.uid));

    try {
      await setDoc(documentRef, {
        name: normalizeFolderName(name),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to create presentation folder", error);

      throw new FirestoreOperationError(
        "Failed to create presentation folder.",
        error,
      );
    }

    return documentRef.id;
  }

  async renameFolder(id: string, name: string): Promise<void> {
    const user = this.requireAuthenticatedUser();
    this.assertValidFolderName(name);

    const documentRef = folderDocumentRef(user.uid, id);

    try {
      await updateDoc(documentRef, {
        name: normalizeFolderName(name),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Failed to rename presentation folder "${id}"`, error);

      throw new FirestoreOperationError(
        `Failed to rename presentation folder "${id}".`,
        error,
      );
    }
  }

  async deleteFolder(id: string): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const documentRef = folderDocumentRef(user.uid, id);

    try {
      await deleteDoc(documentRef);
    } catch (error) {
      console.error(`Failed to delete presentation folder "${id}"`, error);

      throw new FirestoreOperationError(
        `Failed to delete presentation folder "${id}".`,
        error,
      );
    }
  }

  private assertValidFolderName(name: string): void {
    if (!isValidFolderName(name)) {
      throw new InvalidFolderNameError(
        `Folder name must be 1-${MAX_FOLDER_NAME_LENGTH} characters after trimming whitespace.`,
      );
    }
  }
}
