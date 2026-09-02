import type { Presentation } from "@powershow/document-schema";
import {
  assertPresentationId,
  encodePresentationForFirestore,
  parsePresentationJsonForRecovery,
  PresentationIdentityError,
  PresentationTooLargeError,
} from "@powershow/firebase";

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { getFirebaseFirestore } from "./firebase-client";
import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import {
  FirestoreOperationError,
  PersistenceError,
  PresentationRecoveryFailedError,
} from "./persistence-errors";
import {
  assertValidPresentationForPersistence,
  deriveThumbnailPreview,
  extractPresentationSummary,
  normalizePersistenceMetadata,
  parsePersistedPresentation,
  type PresentationSummary,
} from "./presentation-persistence";
import {
  analyzePresentationRecovery,
} from "./presentation-recovery";
import type {
  CreatePresentationOptions,
  ListPresentationsOptions,
  PresentationPublishResult,
  PresentationRecoveryInspection,
  PresentationRepairResult,
  PresentationRepository,
} from "./presentation-repository";

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

function folderDocumentRef(userId: string, folderId: string) {
  const firestore = getFirebaseFirestore();

  return doc(firestore, "users", userId, "presentationFolders", folderId);
}

/**
 * Firestore-backed Presentation repository.
 *
 * One Firestore document stores the complete canonical Presentation for a
 * single user under: users/{uid}/presentations/{presentationId}
 */
export class FirestorePresentationRepository implements PresentationRepository {
  private requireAuthenticatedUser() {
    return requireAuthenticatedFirebaseUser(getCurrentNonAnonymousUser);
  }

  async listPresentations(
    options: ListPresentationsOptions = {},
  ): Promise<PresentationSummary[]> {
    const includeArchived = options.includeArchived ?? false;
    const user = this.requireAuthenticatedUser();
    const presentationsRef = presentationsCollection(user.uid);

    try {
      const snapshot = await getDocs(
        query(presentationsRef, orderBy("updatedAt", "desc")),
      );
      const summaries: PresentationSummary[] = [];

      for (const document of snapshot.docs) {
        const data = document.data();
        let presentation: Presentation;
        try {
          presentation = parsePersistedPresentation(data);
        } catch {
          continue;
        }
        assertPresentationId(presentation, document.id);

        const archivedAt = data.archivedAt;

        if (
          !includeArchived &&
          archivedAt !== undefined &&
          archivedAt !== null
        ) {
          continue;
        }

        const summary = extractPresentationSummary({
          id: (presentation as { id: string }).id,
          title: (presentation as { title: string }).title,
          updatedAt: data.updatedAt,
          archivedAt: archivedAt ?? undefined,
          folderId: data.folderId,
          draftRevision: data.draftRevision,
          publication: data.publication,
        });

        const thumbnailPreview = deriveThumbnailPreview(presentation);

        if (thumbnailPreview) {
          summary.thumbnailPreview = thumbnailPreview;
        }

        summaries.push(summary);
      }

      return summaries;
    } catch (error) {
      if (error instanceof PresentationIdentityError) {
        throw error;
      }
      console.error("Failed to list presentations", error);

      throw new FirestoreOperationError("Failed to list presentations.", error);
    }
  }

  async getPresentation(id: string): Promise<Presentation | null> {
    const user = this.requireAuthenticatedUser();
    const documentRef = presentationDocumentRef(user.uid, id);

    try {
      const snapshot = await getDoc(documentRef);

      if (!snapshot.exists()) {
        return null;
      }

      return assertPresentationId(
        parsePersistedPresentation(snapshot.data()),
        id,
      );
    } catch (error) {
      // Domain errors (e.g. InvalidPersistedPresentationError) must
      // reach callers unchanged: only raw Firestore/Firebase failures
      // are translated into FirestoreOperationError.
      if (
        error instanceof PersistenceError ||
        error instanceof PresentationIdentityError ||
        error instanceof PresentationTooLargeError
      ) {
        throw error;
      }

      console.error(`Failed to read presentation "${id}"`, error);

      throw new FirestoreOperationError(
        `Failed to read presentation "${id}".`,
        error,
      );
    }
  }

  async createPresentation(
    presentation: Presentation,
    options?: CreatePresentationOptions,
  ): Promise<void> {
    const user = this.requireAuthenticatedUser();

    assertValidPresentationForPersistence(presentation);
    assertPresentationId(presentation, presentation.id);
    const presentationJson = encodePresentationForFirestore(presentation).presentationJson;

    const documentRef = presentationDocumentRef(user.uid, presentation.id);

    try {
      await setDoc(documentRef, {
        presentationJson,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        draftRevision: 1,
        ...(options?.folderId ? { folderId: options.folderId } : {}),
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
    const user = this.requireAuthenticatedUser();

    assertValidPresentationForPersistence(presentation);
    assertPresentationId(presentation, presentation.id);
    const presentationJson = encodePresentationForFirestore(presentation).presentationJson;

    const documentRef = presentationDocumentRef(user.uid, presentation.id);

    try {
      await updateDoc(documentRef, {
        presentationJson,
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
    const user = this.requireAuthenticatedUser();
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

  async restorePresentation(id: string): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const documentRef = presentationDocumentRef(user.uid, id);

    try {
      await updateDoc(documentRef, {
        archivedAt: deleteField(),
      });
    } catch (error) {
      console.error(`Failed to restore presentation "${id}"`, error);

      throw new FirestoreOperationError(
        `Failed to restore presentation "${id}".`,
        error,
      );
    }
  }

  /**
   * Permanently delete the private draft of an archived, never-published
   * presentation. Public publication artifacts (pointer and immutable
   * versions) are intentionally untouched: deleting a published presentation
   * is not implemented, so drafts with publication metadata are rejected.
   */
  async deleteArchivedPresentation(id: string): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const documentRef = presentationDocumentRef(user.uid, id);

    try {
      const snapshot = await getDoc(documentRef);

      if (!snapshot.exists()) {
        throw new FirestoreOperationError(
          `Cannot delete missing presentation "${id}".`,
        );
      }

      const data = snapshot.data();

      if (data.archivedAt === undefined || data.archivedAt === null) {
        throw new FirestoreOperationError(
          `Cannot permanently delete non-archived presentation "${id}".`,
        );
      }

      if (data.publication !== undefined && data.publication !== null) {
        throw new FirestoreOperationError(
          `Cannot permanently delete published presentation "${id}".`,
        );
      }

      await deleteDoc(documentRef);

    } catch (error) {
      if (error instanceof PersistenceError) {
        throw error;
      }

      console.error(`Failed to delete archived presentation "${id}"`, error);

      throw new FirestoreOperationError(
        `Failed to delete archived presentation "${id}".`,
        error,
      );
    }
  }

  async movePresentationToFolder(
    id: string,
    folderId: string | null,
  ): Promise<void> {
    const user = this.requireAuthenticatedUser();
    const documentRef = presentationDocumentRef(user.uid, id);

    try {
      if (folderId === null) {
        await updateDoc(documentRef, {
          folderId: deleteField(),
        });
        return;
      }

      const folderSnapshot = await getDoc(
        folderDocumentRef(user.uid, folderId),
      );

      if (!folderSnapshot.exists()) {
        throw new FirestoreOperationError(
          `Cannot move presentation "${id}" into missing folder "${folderId}".`,
        );
      }

      await updateDoc(documentRef, {
        folderId,
      });
    } catch (error) {
      if (error instanceof PersistenceError) {
        throw error;
      }

      console.error(
        `Failed to move presentation "${id}" to folder "${folderId}"`,
        error,
      );

      throw new FirestoreOperationError(
        `Failed to move presentation "${id}" to folder "${folderId}".`,
        error,
      );
    }
  }

  async publishPresentation(id: string): Promise<PresentationPublishResult> {
    const user = this.requireAuthenticatedUser();
    const firestore = getFirebaseFirestore();
    const draftRef = presentationDocumentRef(user.uid, id);

    try {
      return await runTransaction(firestore, async (transaction) => {
        const draftSnapshot = await transaction.get(draftRef);

        if (!draftSnapshot.exists()) {
          throw new FirestoreOperationError(
            `Cannot publish missing presentation "${id}".`,
          );
        }

        const draftData = draftSnapshot.data();

        if (
          draftData.archivedAt !== undefined &&
          draftData.archivedAt !== null
        ) {
          throw new FirestoreOperationError(
            `Cannot publish archived presentation "${id}".`,
          );
        }

        const presentation = assertPresentationId(
          parsePersistedPresentation(draftData),
          id,
        );
        const metadata = normalizePersistenceMetadata(
          draftData.draftRevision,
          draftData.publication,
        );

        // No new revision to publish — leave everything unchanged.
        if (
          metadata.publication &&
          metadata.publication.publishedRevision === metadata.draftRevision
        ) {
          return {
            publicationId: metadata.publication.publicationId,
            versionId: metadata.publication.currentVersionId,
            publishedRevision: metadata.draftRevision,
            createdVersion: false,
          };
        }
        const presentationJson = draftData.presentationJson;

        const publicationId =
          metadata.publication?.publicationId ??
          doc(collection(firestore, "publishedPresentations")).id;
        const versionRef = doc(
          collection(
            firestore,
            "publishedPresentations",
            publicationId,
            "versions",
          ),
        );
        const versionId = versionRef.id;
        const pointerRef = doc(
          firestore,
          "publishedPresentations",
          publicationId,
        );
        // Reuse ONE timestamp for version, pointer, and private draft.
        const publishedAt = serverTimestamp();

        // The private draft is read above before either transaction write.
        transaction.set(versionRef, {
          presentationId: presentation.id,
          presentationJson,
          publishedRevision: metadata.draftRevision,
          publishedAt,
        });
        transaction.set(pointerRef, {
          currentVersionId: versionId,
          publishedRevision: metadata.draftRevision,
          publishedAt,
        });
        transaction.update(draftRef, {
          publication: {
            publicationId,
            currentVersionId: versionId,
            publishedRevision: metadata.draftRevision,
            publishedAt,
          },
        });

        return {
          publicationId,
          versionId,
          publishedRevision: metadata.draftRevision,
          createdVersion: true,
        };
      });
    } catch (error) {
      console.error(`Failed to publish presentation "${id}"`, error);

      if (
        error instanceof PersistenceError ||
        error instanceof PresentationIdentityError ||
        error instanceof PresentationTooLargeError
      ) {
        throw error;
      }

      throw new FirestoreOperationError(
        `Failed to publish presentation "${id}".`,
        error,
      );
    }
  }

  /**
   * Reads the raw persisted draft and runs the recovery analysis.
   *
   * Performs NO writes and never exposes the raw Firestore snapshot:
   * callers only receive the deterministic analysis (status + issues).
   */
  async inspectPresentationRecovery(
    id: string,
  ): Promise<PresentationRecoveryInspection> {
    const user = this.requireAuthenticatedUser();
    const documentRef = presentationDocumentRef(user.uid, id);

    try {
      const snapshot = await getDoc(documentRef);

      if (!snapshot.exists()) {
        throw new FirestoreOperationError(
          `Cannot inspect missing presentation "${id}".`,
        );
      }

      const data = snapshot.data();
      let rawPresentation: unknown;
      try {
        rawPresentation = parsePresentationJsonForRecovery(data.presentationJson);
      } catch {
        rawPresentation = undefined;
      }
      const analysis = analyzePresentationRecovery(rawPresentation);

      return { status: analysis.status, issues: analysis.issues };
    } catch (error) {
      if (error instanceof PersistenceError) {
        throw error;
      }

      console.error(
        `Failed to inspect presentation "${id}" for recovery`,
        error,
      );

      throw new FirestoreOperationError(
        `Failed to inspect presentation "${id}" for recovery.`,
        error,
      );
    }
  }

  /**
   * Repairs a persisted draft, re-reading the current draft inside the
   * transaction at confirmation time.
   *
   * - missing draft -> PresentationRecoveryFailedError, zero writes;
   * - valid current presentation -> returned unchanged with
   *   repaired:false and ZERO writes;
   * - unrecoverable -> PresentationRecoveryFailedError, zero writes;
   * - recoverable -> validates size, then writes ONLY the
   *   canonical draft presentation (updatedAt + draftRevision bump),
   *   preserving createdAt/folderId/publication and never touching the
   *   public publication pointer or immutable published versions.
   */
  async repairPresentation(
    id: string,
  ): Promise<PresentationRepairResult> {
    const user = this.requireAuthenticatedUser();
    const firestore = getFirebaseFirestore();
    const draftRef = presentationDocumentRef(user.uid, id);

    try {
      return await runTransaction(firestore, async (transaction) => {
        const draftSnapshot = await transaction.get(draftRef);

        if (!draftSnapshot.exists()) {
          throw new PresentationRecoveryFailedError(
            `Cannot repair missing presentation "${id}".`,
          );
        }

        const draftData = draftSnapshot.data();

        // Already canonical: nothing to repair, zero writes.
        try {
          const valid = parsePersistedPresentation(draftData);

          return { presentation: valid, repaired: false };
        } catch {
          // Fall through to recovery analysis.
        }

        let rawPresentation: unknown;
        try {
          rawPresentation = parsePresentationJsonForRecovery(
            draftData.presentationJson,
          );
        } catch {
          rawPresentation = undefined;
        }
        const analysis = analyzePresentationRecovery(rawPresentation);

        if (
          analysis.status !== "recoverable" ||
          analysis.presentation === null
        ) {
          throw new PresentationRecoveryFailedError(
            `Presentation "${id}" cannot be repaired.`,
          );
        }

        const repaired = analysis.presentation;

        const presentationJson = encodePresentationForFirestore(repaired).presentationJson;

        transaction.update(draftRef, {
          presentationJson,
          updatedAt: serverTimestamp(),
          draftRevision: increment(1),
        });

        return { presentation: repaired, repaired: true };
      });
    } catch (error) {
      if (
        error instanceof PersistenceError ||
        error instanceof PresentationTooLargeError
      ) {
        throw error;
      }

      console.error(`Failed to repair presentation "${id}"`, error);

      throw new FirestoreOperationError(
        `Failed to repair presentation "${id}".`,
        error,
      );
    }
  }
}
