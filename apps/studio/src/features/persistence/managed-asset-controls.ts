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
import { isManagedAssetControlPath } from "./managed-asset-control-path";
import {
  configuredManagedAssetStoreId,
  managedAssetBlobIdentityFromUrl,
  normalizeManagedAssetStoreId,
} from "./managed-asset-blob-identity";
import type { ManagedAssetIntent } from "./managed-asset-intents";

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
  | "store_mismatch"
  | "asset_available"
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
  if (!isManagedAssetControlPath(uid, storagePath)) throw new ManagedAssetControlError("invalid_identity");
  return storagePath.slice(`users/${uid}/assets/`.length);
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
  const storeId = configuredManagedAssetStoreId(process.env.BLOB_STORE_ID, process.env.BLOB_READ_WRITE_TOKEN);
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

function fontFaceBlobIdentity(face: CustomLibraryFontFace) {
  if (face.provenance && face.provenance.kind !== "managed-upload") return null;
  try {
    const identity = managedAssetBlobIdentityFromUrl(face.source.url);
    if (!identity) return null;
    if (face.provenance?.kind === "managed-upload") {
      const leaf = identity.storagePath.slice(identity.storagePath.lastIndexOf("/") + 1);
      const assetId = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\.[a-z0-9]+)?$/i.exec(leaf)?.[1];
      if (!assetId || face.provenance.assetId.toLowerCase() !== assetId.toLowerCase()) return null;
    }
    return identity;
  } catch {
    return null;
  }
}

function removeFontPath(font: CustomLibraryFontDraft, storagePath: string, storeId: string): CustomLibraryFontDraft | null {
  const faces = font.faces.filter((face) => {
    const identity = fontFaceBlobIdentity(face);
    return identity?.storagePath !== storagePath || identity.storeId !== storeId;
  });
  if (faces.length === font.faces.length) return font;
  return faces.length === 0 ? null : { ...font, faces };
}

function fileSourceMatchesStore(value: FirebaseFirestore.DocumentData | undefined, storagePath: string, storeId: string): boolean {
  if (!value || typeof value !== "object") return false;
  const file = value.file;
  if (!file || typeof file !== "object") return false;
  const source = (file as FirebaseFirestore.DocumentData).source;
  if (!source || typeof source !== "object") return false;
  const record = source as FirebaseFirestore.DocumentData;
  const identity = typeof record.downloadUrl === "string" ? managedAssetBlobIdentityFromUrl(record.downloadUrl) : null;
  return record.storagePath === storagePath && identity?.storagePath === storagePath && identity.storeId === storeId;
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

async function finalizeManagedAssetDeletion(uid: string, storagePath: string, operationId: string, storeId: string): Promise<boolean> {
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
      const next = removeFontPath(font, storagePath, storeId);
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
    fileSnapshot.docs.forEach((document) => {
      if (fileSourceMatchesStore(document.data(), storagePath, storeId)) transaction.delete(document.ref);
    });
    intentDocs.forEach((document) => {
      const intent = document.data() as ManagedAssetIntent;
      const identity = intent.downloadUrl ? managedAssetBlobIdentityFromUrl(intent.downloadUrl) : null;
      if (intent.state === "complete" && identity?.storagePath === storagePath && identity.storeId === storeId) {
        transaction.update(document.ref, { state: "deleted", updatedAt: FieldValue.serverTimestamp() });
      }
    });
    return true;
  });
}

export async function deleteManagedAsset(uid: string, storagePath: string): Promise<{ alreadyMissing: boolean }> {
  managedAssetControlRef(uid, storagePath);

  let alreadyMissing = false;
  const storeId = configuredManagedAssetStoreId(process.env.BLOB_STORE_ID, process.env.BLOB_READ_WRITE_TOKEN);
  const normalizedStoreId = storeId;
  if (!storeId || !normalizedStoreId || !(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim())) {
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
    if (!await finalizeManagedAssetDeletion(uid, storagePath, operationId, normalizedStoreId)) {
      const latest = await readManagedAssetControl(uid, storagePath);
      if (latest?.state !== "deleted") throw new ManagedAssetControlError("deletion_in_progress");
    }
    return { alreadyMissing: alreadyMissing || started.alreadyMissing };
  } catch (error) {
    if (attemptId) await markDeletionFailed(uid, storagePath, operationId, attemptId).catch(() => undefined);
    throw error instanceof ManagedAssetControlError ? error : new ManagedAssetControlError("provider_unavailable");
  }
}

async function assertManagedAssetMissing(storagePath: string, expectedStoreId: string): Promise<string> {
  const configuredStoreId = process.env.BLOB_STORE_ID?.trim();
  const storeId = configuredManagedAssetStoreId(configuredStoreId, process.env.BLOB_READ_WRITE_TOKEN);
  const expected = normalizeManagedAssetStoreId(expectedStoreId);
  if (!configuredStoreId || !storeId || !expected || storeId !== expected
    || !(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim())) {
    throw new ManagedAssetControlError(storeId && expected && storeId !== expected ? "store_mismatch" : "provider_unavailable");
  }
  try {
    const physical = await head(storagePath, { storeId });
    if (physical.pathname !== storagePath) throw new ManagedAssetControlError("identity_conflict");
    throw new ManagedAssetControlError("asset_available");
  } catch (error) {
    if (error instanceof ManagedAssetControlError) throw error;
    if (error instanceof BlobNotFoundError) return storeId;
    throw new ManagedAssetControlError("provider_unavailable");
  }
}

async function reserveMissingAssetReconciliation(
  uid: string,
  storagePath: string,
  storeId: string,
  operationId: string,
  attemptId: string,
): Promise<{ operationId: string; attemptId: string; alreadyReconciled: boolean }> {
  const controlRef = managedAssetControlRef(uid, storagePath);
  const firestore = db();
  return firestore.runTransaction(async (transaction) => {
    const controlSnapshot = await transaction.get(controlRef);
    if (!controlSnapshot.exists) throw new ManagedAssetControlError("not_found");
    const current = parseControl(controlSnapshot.data(), storagePath);
    if (current?.state === "deleted") return { operationId: current.deleteOperationId ?? operationId, attemptId, alreadyReconciled: true };
    if (!current) throw new ManagedAssetControlError("not_found");
    if (current.protected) throw new ManagedAssetControlError("protected");

    let reservedOperationId = operationId;
    if (current.state === "deleting") {
      if (current.deleteLeaseExpiresAt instanceof Timestamp && current.deleteLeaseExpiresAt.toMillis() > Date.now()) {
        throw new ManagedAssetControlError("deletion_in_progress");
      }
      if (!current.deleteOperationId) throw new ManagedAssetControlError("identity_conflict");
      reservedOperationId = current.deleteOperationId;
    } else if (current.state === "delete_failed") {
      if (!current.deleteOperationId) throw new ManagedAssetControlError("identity_conflict");
      reservedOperationId = current.deleteOperationId;
    } else if (current.state !== "active" || current.deleteAttemptId || current.deleteOperationId || current.deleteLeaseExpiresAt) {
      throw new ManagedAssetControlError("deletion_in_progress");
    }

    const intentQuery = firestore.collection(`users/${uid}/managedAssets`)
      .where("storagePath", "==", storagePath);
    const intentSnapshot = await transaction.get(intentQuery);
    const intentDocs = intentSnapshot.docs as QueryDocumentSnapshot[];
    const intents = intentDocs.map((document) => document.data() as ManagedAssetIntent);
    if (intents.some((intent) => intent.state !== "complete" && intent.state !== "deleted")) {
      throw new ManagedAssetControlError("upload_in_progress");
    }
    for (const intent of intents) {
      if (intent.state !== "complete") continue;
      if (!intent.downloadUrl) throw new ManagedAssetControlError("identity_conflict");
      const identity = managedAssetBlobIdentityFromUrl(intent.downloadUrl);
      if (identity?.storagePath !== storagePath) throw new ManagedAssetControlError("identity_conflict");
      if (identity.storeId !== storeId) throw new ManagedAssetControlError("store_mismatch");
    }

    transaction.set(controlRef, {
      ...current,
      state: "deleting",
      deleteAttemptId: attemptId,
      deleteOperationId: reservedOperationId,
      deleteLeaseExpiresAt: Timestamp.fromMillis(Date.now() + DELETE_LEASE_MS),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { operationId: reservedOperationId, attemptId, alreadyReconciled: false };
  });
}

async function restoreActiveAfterReconciliation(
  uid: string,
  storagePath: string,
  operationId: string,
  attemptId: string,
): Promise<void> {
  const ref = managedAssetControlRef(uid, storagePath);
  await db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const current = parseControl(snapshot.data(), storagePath);
    if (current?.state !== "deleting" || current.deleteOperationId !== operationId || current.deleteAttemptId !== attemptId) return;
    transaction.update(ref, {
      state: "active",
      deleteAttemptId: FieldValue.delete(),
      deleteOperationId: FieldValue.delete(),
      deleteLeaseExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Explicitly reconciles an owner-scoped managed asset whose Blob is confirmed absent.
 * The control transition blocks PowerShow upload intents while Firestore associations
 * are finalized. Blob and Firestore cannot participate in one atomic transaction, so
 * a direct provider-side re-upload after the final absence check remains outside this
 * operation's race guarantees; this operation never issues a physical delete.
 */
export async function reconcileMissingManagedAsset(
  uid: string,
  storagePath: string,
  expectedStoreId: string,
): Promise<{ alreadyReconciled: boolean }> {
  managedAssetControlRef(uid, storagePath);
  const storeId = await assertManagedAssetMissing(storagePath, expectedStoreId);
  const operationId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const reservation = await reserveMissingAssetReconciliation(uid, storagePath, storeId, operationId, attemptId);
  if (reservation.alreadyReconciled) return { alreadyReconciled: true };

  try {
    // Recheck after acquiring the Firestore upload barrier; the UI's earlier status
    // is informational and never authorizes this mutation.
    await assertManagedAssetMissing(storagePath, storeId);
    if (!await finalizeManagedAssetDeletion(uid, storagePath, reservation.operationId, storeId)) {
      const latest = await readManagedAssetControl(uid, storagePath);
      if (latest?.state !== "deleted") throw new ManagedAssetControlError("deletion_in_progress");
    }
    return { alreadyReconciled: false };
  } catch (error) {
    await restoreActiveAfterReconciliation(uid, storagePath, reservation.operationId, reservation.attemptId).catch(() => undefined);
    const latest = await readManagedAssetControl(uid, storagePath).catch(() => null);
    if (latest?.state === "deleted") return { alreadyReconciled: true };
    throw error instanceof ManagedAssetControlError ? error : new ManagedAssetControlError("provider_unavailable");
  }
}
