import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import type { CustomLibraryPaletteDraft } from "../custom-library/custom-library-palette";
import { parseCustomLibraryPaletteDraft } from "../custom-library/custom-library-palette-schema";
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "../custom-library/custom-library-palette-repository";
import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseFirestore } from "./firebase-client";
import {
  FirestoreOperationError,
  InvalidCustomLibraryPaletteForPersistenceError,
  InvalidPersistedCustomLibraryPaletteError,
} from "./persistence-errors";

function customLibraryPalettesCollection(userId: string): ReturnType<typeof collection> {
  return collection(getFirebaseFirestore(), "users", userId, "customLibraryPalettes");
}

function customLibraryPaletteDocumentRef(userId: string, paletteId: string) {
  return doc(
    getFirebaseFirestore(),
    "users",
    userId,
    "customLibraryPalettes",
    paletteId,
  );
}

export class FirestoreCustomLibraryPaletteRepository implements CustomLibraryPaletteRepository {
  private requireAuthenticatedUser() {
    return requireAuthenticatedFirebaseUser(getCurrentNonAnonymousUser);
  }

  async savePalette(palette: CustomLibraryPaletteDraft): Promise<string> {
    const user = this.requireAuthenticatedUser();
    let validatedPalette: CustomLibraryPaletteDraft;

    try {
      validatedPalette = parseCustomLibraryPaletteDraft(palette);
    } catch (error) {
      throw new InvalidCustomLibraryPaletteForPersistenceError(
        "Custom Library palette is invalid for persistence.",
        error,
      );
    }

    const documentRef = doc(customLibraryPalettesCollection(user.uid));

    try {
      await setDoc(documentRef, validatedPalette);
    } catch (error) {
      console.error("Failed to save Custom Library palette.", error);
      throw new FirestoreOperationError(
        "Failed to save Custom Library palette.",
        error,
      );
    }

    return documentRef.id;
  }

  async updatePalette(
    id: string,
    palette: CustomLibraryPaletteDraft,
  ): Promise<void> {
    const user = this.requireAuthenticatedUser();
    let validatedPalette: CustomLibraryPaletteDraft;

    try {
      validatedPalette = parseCustomLibraryPaletteDraft(palette);
    } catch (error) {
      throw new InvalidCustomLibraryPaletteForPersistenceError(
        "Custom Library palette is invalid for persistence.",
        error,
      );
    }

    const documentRef = customLibraryPaletteDocumentRef(user.uid, id);
    let snapshot: Awaited<ReturnType<typeof getDoc>>;

    try {
      snapshot = await getDoc(documentRef);
    } catch (error) {
      console.error(`Failed to update Custom Library palette "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to update Custom Library palette "${id}".`,
        error,
      );
    }

    if (!snapshot.exists()) {
      throw new FirestoreOperationError(
        `Failed to update Custom Library palette "${id}": palette does not exist.`,
      );
    }

    try {
      await setDoc(documentRef, validatedPalette);
    } catch (error) {
      console.error(`Failed to update Custom Library palette "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to update Custom Library palette "${id}".`,
        error,
      );
    }
  }

  async listPalettes(): Promise<CustomLibraryPaletteRecord[]> {
    const user = this.requireAuthenticatedUser();
    let snapshot: Awaited<ReturnType<typeof getDocs>>;

    try {
      snapshot = await getDocs(customLibraryPalettesCollection(user.uid));
    } catch (error) {
      console.error("Failed to list Custom Library palettes.", error);
      throw new FirestoreOperationError(
        "Failed to list Custom Library palettes.",
        error,
      );
    }

    return snapshot.docs.map((document) => {
      try {
        return {
          id: document.id,
          palette: parseCustomLibraryPaletteDraft(document.data()),
        };
      } catch (error) {
        throw new InvalidPersistedCustomLibraryPaletteError(
          `Persisted Custom Library palette "${document.id}" is invalid.`,
          error,
        );
      }
    });
  }

  async getPalette(id: string): Promise<CustomLibraryPaletteRecord | null> {
    const user = this.requireAuthenticatedUser();
    const documentRef = customLibraryPaletteDocumentRef(user.uid, id);
    let snapshot: Awaited<ReturnType<typeof getDoc>>;

    try {
      snapshot = await getDoc(documentRef);
    } catch (error) {
      console.error(`Failed to load Custom Library palette "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to load Custom Library palette "${id}".`,
        error,
      );
    }

    if (!snapshot.exists()) {
      return null;
    }

    try {
      return {
        id: snapshot.id,
        palette: parseCustomLibraryPaletteDraft(snapshot.data()),
      };
    } catch (error) {
      throw new InvalidPersistedCustomLibraryPaletteError(
        `Persisted Custom Library palette "${snapshot.id}" is invalid.`,
        error,
      );
    }
  }

  async deletePalette(id: string): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const documentRef = customLibraryPaletteDocumentRef(user.uid, id);

    try {
      await deleteDoc(documentRef);
    } catch (error) {
      console.error(`Failed to delete Custom Library palette "${id}".`, error);
      throw new FirestoreOperationError(
        `Failed to delete Custom Library palette "${id}".`,
        error,
      );
    }
  }
}
