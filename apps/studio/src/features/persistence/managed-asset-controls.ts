import { BlobNotFoundError, del, head } from "@vercel/blob";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Transaction,
} from "firebase-admin/firestore";

import { getFirebaseAdminApp } from "../auth/firebase-admin-auth";
import type { CustomLibraryFontDraft, CustomLibraryFontFace } from "../custom-library/custom-library-font";
import { parseCustomLibraryFontDraft } from "../custom-library/custom-library-font-schema";
import { classifyManagedAssetExtension } from "./managed-asset-content-types";
import type { ManagedAssetIntent } from "./managed-asset-intents";

const ASSET_LEAF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const UUID_WITH_EXTENSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(\.[a-z0-9]+)$/i;
const DELETE_LEASE_MS = 2 * 60 * 1000;

export type ManagedAssetControlState = "active" | "deleting" | "delete_failed" | "deleted";

export interface ManagedAssetControl {
  storagePath: string;
  protected: boolean;
  state: ManagedAssetControlState;
  displayName?: string;
  deleteAttemptId?: string;
  deleteLeaseExpiresAt?: Timestamp;
  deleteOperationId?: string;
}

export type ManagedAssetControlErrorCode =
  | "invalid_identity"
  | "not_found"
  | "protected"
  | "deletion_in_progress"
  | "already_deleted"
  | "upload_in_progress"
  | "provider_unavailable"
  | "identity_conflict"
  | "invalid_display_name";

export class ManagedAssetControlError extends Error {
  constructor(readonly code: ManagedAssetControlErrorCode) {
    super(code);
    this.name = "ManagedAssetControlError";
  }
}
function db() {
  return getFirestore(getFirebaseAdminApp());
}

export function validateManagedAssetDisplayName(value: unknown): string {
  if (typeof value !== "string") throw new ManagedAssetControlError("invalid_display_name");
  const name = value.trim();
  if (!name || Array.from(name).length > 512 || /[\\/\p{Cc}]/u.test(name)) {
    throw new ManagedAssetControlError("invalid_display_name");
  }
  return name;
}

export function validateManagedAssetPath(uid: string, storagePath: unknown): string {
  if (typeof storagePath !== "string" || storagePath.length > 512 || /[\x00-\x1f\x7f]/.test(storagePath)) {
    throw new ManagedAssetControlError("invalid_identity");
  }
  const prefix = `users/${uid}/assets/`;
  if (!uid || uid.includes("/") || !storagePath.startsWith(prefix)) {
    throw new ManagedAssetControlError("invalid_identity");
  }
  const leaf = storagePath.slice(prefix.length);
  if (!ASSET_LEAF_PATTERN.test(leaf) || leaf === "." || leaf === ".." || storagePath !== `${prefix}${leaf}`) {
    throw new ManagedAssetControlError("invalid_identity");
  }
  if (leaf.includes(".")) {
    const match = UUID_WITH_EXTENSION_PATTERN.exec(leaf);
    if (!match?.[1] || !classifyManagedAssetExtension(match[1])) throw new ManagedAssetControlError("invalid_identity");
  }
  return leaf;
}

export function managedAssetControlRef(uid: string, storagePath: string): DocumentReference {
  const leaf = validateManagedAssetPath(uid, storagePath);
  return db().doc(`users/${uid}/managedAssetControls/${leaf}`);
}

function parseControl(value: FirebaseFirestore.DocumentData | undefined, storagePath: string): ManagedAssetControl | null {
  if (!value) return null;
  if (value.storagePath !== storagePath || typeof value.protected !== "boolean"
    || !["active", "deleting", "delete_failed", "deleted"].includes(value.state)) {
    throw new ManagedAssetControlError("identity_conflict");
  }
  if (value.displayName !== undefined) {
    try {
      const displayName = validateManagedAssetDisplayName(value.displayName);
      if (displayName !== value.displayName) throw new ManagedAssetControlError("identity_conflict");
    } catch {
      throw new ManagedAssetControlError("identity_conflict");
    }
  }
  return value as ManagedAssetControl;
}

export async function readManagedAssetDisplayNames(uid: string, storagePaths: readonly string[]): Promise<Map<string, string>> {
  const paths = [...new Set(storagePaths)];
  const refs = paths.map((storagePath) => managedAssetControlRef(uid, storagePath));
  const snapshots = refs.length ? await db().getAll(...refs) : [];
  const names = new Map<string, string>();
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) return;
    const storagePath = paths[index];
    if (!storagePath) throw new ManagedAssetControlError("identity_conflict");
    const control = parseControl(snapshot.data(), storagePath);
    if (control?.displayName) names.set(storagePath, control.displayName);
  });
  return names;
}

export async function readManagedAssetControl(uid: string, storagePath: string): Promise<ManagedAssetControl | null> {
  const ref = managedAssetControlRef(uid, storagePath);
  const snapshot = await ref.get();
  return snapshot.exists ? parseControl(snapshot.data(), storagePath) : null;
}

async function assertPhysicalObject(storagePath: string): Promise<void> {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!storeId || !(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim())) {
    throw new ManagedAssetControlError("provider_unavailable");
  }
  try {
    const physical = await head(storagePath, { storeId });
    if (physical.pathname !== storagePath) throw new ManagedAssetControlError("identity_conflict");
  } catch (error) {
    if (error instanceof ManagedAssetControlError) throw error;
    if (error instanceof BlobNotFoundError) throw new ManagedAssetControlError("not_found");
    throw new ManagedAssetControlError("provider_unavailable");
  }
}

export async function setManagedAssetProtection(uid: string, storagePath: string, protectedValue: boolean): Promise<ManagedAssetControl> {
  managedAssetControlRef(uid, storagePath);
  await assertPhysicalObject(storagePath);
  const ref = managedAssetControlRef(uid, storagePath);
  return db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? parseControl(snapshot.data(), storagePath) : null;
    if (current?.state === "deleted") throw new ManagedAssetControlError("already_deleted");
    if (current?.state === "deleting" || current?.state === "delete_failed") {
      throw new ManagedAssetControlError("deletion_in_progress");
    }
    const next: ManagedAssetControl = { ...current, storagePath, protected: protectedValue, state: "active" };
    transaction.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp() });
    return next;
  });
}

export async function renameManagedAsset(uid: string, storagePath: string, rawDisplayName: unknown): Promise<ManagedAssetControl> {
  managedAssetControlRef(uid, storagePath);
  const displayName = validateManagedAssetDisplayName(rawDisplayName);
  await assertPhysicalObject(storagePath);
  const ref = managedAssetControlRef(uid, storagePath);
  return db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? parseControl(snapshot.data(), storagePath) : null;
    if (current?.state === "deleted") throw new ManagedAssetControlError("already_deleted");
    if (current?.state !== undefined && current.state !== "active") {
      throw new ManagedAssetControlError("deletion_in_progress");
    }
    const next: ManagedAssetControl = { ...current, storagePath, protected: current?.protected ?? false, state: "active", displayName };
    transaction.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp() });
    return next;
  });
}

function fontFaceStoragePath(face: CustomLibraryFontFace): string | null {
  try {
    const url = new URL(face.source.url);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
    return decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function removeFontPath(font: CustomLibraryFontDraft, storagePath: string): CustomLibraryFontDraft | null {
  const faces = font.faces.filter((face) => fontFaceStoragePath(face) !== storagePath);
  if (faces.length === font.faces.length) return font;
  return faces.length === 0 ? null : { ...font, faces };
}

function queryFontDocs(transaction: Transaction, uid: string) {
  return transaction.get(db().collection(`users/${uid}/customLibraryFonts`));
}

interface BeginDeleteResult {
  operationId: string | null;
  attemptId: string | null;
  alreadyDeleted: boolean;
  alreadyMissing: boolean;
}

async function beginManagedAssetDeletion(
  uid: string,
  storagePath: string,
  candidateOperationId: string,
  candidateAttemptId: string,
  blobMissing: boolean,
): Promise<BeginDeleteResult> {
  const controlRef = managedAssetControlRef(uid, storagePath);
  const firestore = db();
  return firestore.runTransaction(async (transaction) => {
    const controlSnapshot = await transaction.get(controlRef);
    const current = controlSnapshot.exists ? parseControl(controlSnapshot.data(), storagePath) : null;
    if (current?.state === "deleted") return {
      operationId: current.deleteOperationId ?? null,
      attemptId: null,
      alreadyDeleted: true,
      alreadyMissing: blobMissing,
    };
    if (current?.protected) throw new ManagedAssetControlError("protected");
    const now = Date.now();
    const existingOperationId = current?.deleteOperationId;
    if (current?.state === "deleting" && current.deleteLeaseExpiresAt instanceof Timestamp
      && current.deleteLeaseExpiresAt.toMillis() > now) {
      if (!blobMissing) throw new ManagedAssetControlError("deletion_in_progress");
      if (!existingOperationId) throw new ManagedAssetControlError("identity_conflict");
      // The prior operation may still be executing. A confirmed absent Blob
      // lets its exact path be finalized without starting another provider call.
      return { operationId: existingOperationId, attemptId: current.deleteAttemptId ?? null, alreadyDeleted: false, alreadyMissing: true };
    }

    const intentQuery = firestore.collection(`users/${uid}/managedAssets`)
      .where("storagePath", "==", storagePath);
    const intentSnapshot = await transaction.get(intentQuery);
    const intentDocs = intentSnapshot.docs as QueryDocumentSnapshot[];
    const intents = intentDocs.map((document) => document.data() as ManagedAssetIntent);
    if (intents.some((intent) => intent.state !== "complete" && intent.state !== "deleted")) {
      throw new ManagedAssetControlError("upload_in_progress");
    }

    if (blobMissing && current?.state !== "deleting" && current?.state !== "delete_failed") {
      throw new ManagedAssetControlError("not_found");
    }
    if ((current?.state === "deleting" || current?.state === "delete_failed") && !existingOperationId) {
      throw new ManagedAssetControlError("identity_conflict");
    }

    const operationId = existingOperationId ?? candidateOperationId;

    transaction.set(controlRef, {
      ...current,
      storagePath,
      protected: false,
      state: "deleting",
      deleteAttemptId: candidateAttemptId,
      deleteOperationId: operationId,
      deleteLeaseExpiresAt: Timestamp.fromMillis(now + DELETE_LEASE_MS),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { operationId, attemptId: candidateAttemptId, alreadyDeleted: false, alreadyMissing: blobMissing };
  });
}

async function markDeletionFailed(uid: string, storagePath: string, operationId: string, attemptId: string): Promise<void> {
  const ref = managedAssetControlRef(uid, storagePath);
  await db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const current = parseControl(snapshot.data(), storagePath);
    if (current?.state !== "deleting" || current.deleteOperationId !== operationId || current.deleteAttemptId !== attemptId) return;
    transaction.update(ref, {
      state: "delete_failed",
      deleteAttemptId: FieldValue.delete(),
      deleteLeaseExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function finalizeManagedAssetDeletion(uid: string, storagePath: string, operationId: string): Promise<boolean> {
  const ref = managedAssetControlRef(uid, storagePath);
  return db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;
    const current = parseControl(snapshot.data(), storagePath);
    if (current?.state === "deleted") return true;
    if ((current?.state !== "deleting" && current?.state !== "delete_failed") || current.deleteOperationId !== operationId) return false;

    const firestore = db();
    const fileQuery = firestore.collection(`users/${uid}/customLibraryFiles`)
      .where("file.source.storagePath", "==", storagePath);
    const intentQuery = firestore.collection(`users/${uid}/managedAssets`)
      .where("storagePath", "==", storagePath);
    const [fontSnapshot, fileSnapshot, intentSnapshot] = await Promise.all([
      queryFontDocs(transaction, uid),
      transaction.get(fileQuery),
      transaction.get(intentQuery),
    ]);
    const intentDocs = intentSnapshot.docs as QueryDocumentSnapshot[];
    const intents = intentDocs.map((document) => document.data() as ManagedAssetIntent);
    if (intents.some((intent) => intent.state !== "complete" && intent.state !== "deleted")) {
      throw new ManagedAssetControlError("upload_in_progress");
    }

    const fontUpdates: Array<{ ref: DocumentReference; value: CustomLibraryFontDraft | null }> = [];
    fontSnapshot.docs.forEach((document) => {
      const font = parseCustomLibraryFontDraft(document.data());
      const next = removeFontPath(font, storagePath);
      if (next !== font) fontUpdates.push({ ref: document.ref, value: next });
    });

    transaction.update(ref, {
      state: "deleted",
      protected: false,
      deleteAttemptId: FieldValue.delete(),
      deleteLeaseExpiresAt: FieldValue.delete(),
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    fontUpdates.forEach(({ ref: fontRef, value }) => value ? transaction.set(fontRef, value) : transaction.delete(fontRef));
    fileSnapshot.docs.forEach((document) => transaction.delete(document.ref));
    intentDocs.forEach((document) => {
      if ((document.data() as ManagedAssetIntent).state === "complete") {
        transaction.update(document.ref, { state: "deleted", updatedAt: FieldValue.serverTimestamp() });
      }
    });
    return true;
  });
}

export async function deleteManagedAsset(uid: string, storagePath: string): Promise<{ alreadyMissing: boolean }> {
  managedAssetControlRef(uid, storagePath);

  let alreadyMissing = false;
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!storeId || !(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim())) {
    throw new ManagedAssetControlError("provider_unavailable");
  }
  try {
    const physical = await head(storagePath, { storeId });
    if (physical.pathname !== storagePath) throw new ManagedAssetControlError("identity_conflict");
  } catch (error) {
    if (error instanceof ManagedAssetControlError) throw error;
    if (error instanceof BlobNotFoundError) {
      alreadyMissing = true;
    } else {
      throw new ManagedAssetControlError("provider_unavailable");
    }
  }

  const candidateOperationId = crypto.randomUUID();
  const candidateAttemptId = crypto.randomUUID();
  const started = await beginManagedAssetDeletion(uid, storagePath, candidateOperationId, candidateAttemptId, alreadyMissing);
  if (started.alreadyDeleted) {
    if (alreadyMissing) return { alreadyMissing: true };
    throw new ManagedAssetControlError("already_deleted");
  }
  if (!started.operationId) throw new ManagedAssetControlError("identity_conflict");
  const operationId = started.operationId;
  const attemptId = started.attemptId;

  try {
    if (!started.alreadyMissing) {
      if (!attemptId) throw new ManagedAssetControlError("identity_conflict");
      await del(storagePath, { storeId });
      try {
        const afterDelete = await head(storagePath, { storeId });
        if (afterDelete.pathname !== storagePath) throw new ManagedAssetControlError("identity_conflict");
        throw new ManagedAssetControlError("provider_unavailable");
      } catch (error) {
        if (!(error instanceof BlobNotFoundError)) throw error;
      }
    }
    if (!await finalizeManagedAssetDeletion(uid, storagePath, operationId)) {
      const latest = await readManagedAssetControl(uid, storagePath);
      if (latest?.state !== "deleted") throw new ManagedAssetControlError("deletion_in_progress");
    }
    return { alreadyMissing: alreadyMissing || started.alreadyMissing };
  } catch (error) {
    if (attemptId) await markDeletionFailed(uid, storagePath, operationId, attemptId).catch(() => undefined);
    throw error instanceof ManagedAssetControlError ? error : new ManagedAssetControlError("provider_unavailable");
  }
}
