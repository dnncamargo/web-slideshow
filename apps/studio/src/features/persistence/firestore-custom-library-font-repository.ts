import {
  collection,
  doc,
  getDoc,
  getDocs,
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
  type StablePersistenceOptions,
} from "./firestore-idempotency";
import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseFirestore } from "./firebase-client";
import {
  CustomLibraryFontRemovalDeniedError,
  FirestoreOperationError,
  InvalidCustomLibraryFontForPersistenceError,
  InvalidPersistedCustomLibraryFontError,
} from "./persistence-errors";

async function writeFontApi(
  user: ReturnType<typeof requireAuthenticatedFirebaseUser>,
  method: "POST" | "PUT" | "DELETE",
  body: Record<string, unknown>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch("/api/custom-library/fonts", {
      method,
      headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new FirestoreOperationError("Failed to write Custom Library font.", error);
  }
  let result: unknown;
  try { result = await response.json(); } catch { result = null; }
  if (!response.ok) {
    const code = typeof result === "object" && result !== null ? (result as Record<string, unknown>).error : undefined;
    if (code === "managed_face_removal_denied") {
      throw new CustomLibraryFontRemovalDeniedError("Fonts cannot remove a managed Storage face.");
    }
    throw new FirestoreOperationError("Failed to write Custom Library font.");
  }
  return result;
}

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

    try {
      const result = await writeFontApi(user, "POST", {
        operation: "save", font: validatedFont,
        ...(options.documentId !== undefined ? { documentId: options.documentId } : {}),
      });
      if (typeof result !== "object" || result === null || typeof (result as Record<string, unknown>).id !== "string") {
        throw new FirestoreOperationError("Custom Library font save response is invalid.");
      }
      return (result as Record<string, string>).id;
    } catch (error) {
      if (error instanceof FirestoreOperationError) throw error;
      console.error("Failed to save Custom Library font.", error);
      throw new FirestoreOperationError("Failed to save Custom Library font.", error);
    }

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

    try {
      await writeFontApi(user, "PUT", { operation: "update", id, font: validatedFont });
    } catch (error) {
      if (error instanceof CustomLibraryFontRemovalDeniedError) throw error;
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
    try {
      await writeFontApi(user, "DELETE", { operation: "delete", id });
    } catch (error) {
      if (error instanceof CustomLibraryFontRemovalDeniedError) throw error;
      console.error(`Failed to delete Custom Library font "${id}".`, error);
      throw new FirestoreOperationError(`Failed to delete Custom Library font "${id}".`, error);
    }
  }
}
