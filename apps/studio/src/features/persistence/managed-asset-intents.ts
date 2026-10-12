import { BlobNotFoundError, head, type HeadBlobResult } from "@vercel/blob";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminApp } from "../auth/firebase-admin-auth";
import { classifyManagedAssetExtension } from "./managed-asset-content-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ETAG_PATTERN = /^[^\s\u0000-\u001f\u007f]{1,512}$/;
const ACTIVE_UPLOAD_LEASE_MS = 2 * 60 * 1000;

export type ManagedAssetIntentState = "pending" | "uploading" | "uncertain" | "complete" | "conflict";

export interface ManagedAssetIntentInput {
  assetId: string;
  originalFilename: string;
  extension: string;
  contentType: string;
  expectedSizeBytes: number;
  sourceLastModified: number;
}

export interface ManagedAssetIntent extends ManagedAssetIntentInput {
  storagePath: string;
  state: ManagedAssetIntentState;
  downloadUrl?: string;
  etag?: string;
  sizeBytes?: number;
}

export interface ReconciledManagedAsset {
  status: "absent" | "in_progress" | "complete" | "conflict" | "uncertain";
  result?: {
    assetId: string;
    storagePath: string;
    downloadUrl: string;
    contentType: string;
    sizeBytes: number;
    etag: string;
  };
}

export class ManagedAssetPhysicalCheckError extends Error {
  constructor() {
    super("Managed asset physical state could not be checked. Retry the same upload operation.");
    this.name = "ManagedAssetPhysicalCheckError";
  }
}

function firestore() {
  return getFirestore(getFirebaseAdminApp());
}

function intentRef(uid: string, assetId: string) {
  return firestore().doc(`users/${uid}/managedAssets/${assetId}`);
}

function validateIntentInput(input: ManagedAssetIntentInput, uid: string): string {
  if (!UUID_PATTERN.test(input.assetId)) throw new Error("invalid_identity");
  const classification = classifyManagedAssetExtension(input.extension);
  if (!classification || classification.contentType !== input.contentType) throw new Error("invalid_type");
  if (!Number.isSafeInteger(input.expectedSizeBytes) || input.expectedSizeBytes < 0) throw new Error("invalid_size");
  if (!Number.isSafeInteger(input.sourceLastModified) || input.sourceLastModified < 0) throw new Error("invalid_descriptor");
  const filename = input.originalFilename.trim();
  if (!filename || filename.length > 512 || filename.includes("/") || filename.includes("\\")) throw new Error("invalid_descriptor");
  return `users/${uid}/assets/${input.assetId}${classification.extension}`;
}

function descriptorMatches(data: Record<string, unknown>, input: ManagedAssetIntentInput, storagePath: string): boolean {
  return data.assetId === input.assetId
    && data.storagePath === storagePath
    && data.originalFilename === input.originalFilename
    && data.extension === input.extension
    && data.contentType === input.contentType
    && data.expectedSizeBytes === input.expectedSizeBytes
    && data.sourceLastModified === input.sourceLastModified;
}

export async function createManagedAssetIntent(uid: string, input: ManagedAssetIntentInput): Promise<ManagedAssetIntent> {
  const storagePath = validateIntentInput(input, uid);
  const canonicalInput = {
    ...input,
    extension: classifyManagedAssetExtension(input.extension)!.extension,
  };
  const ref = intentRef(uid, input.assetId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const data = snapshot.data() as Record<string, unknown>;
      if (!descriptorMatches(data, canonicalInput, storagePath)) throw new Error("identity_conflict");
      return data as unknown as ManagedAssetIntent;
    }
    const intent: ManagedAssetIntent = {
      ...canonicalInput,
      storagePath,
      state: "pending",
    };
    transaction.create(ref, {
      ...intent,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return intent;
  });
}

export async function listManagedAssetIntents(uid: string): Promise<ManagedAssetIntent[]> {
  const snapshot = await firestore().collection(`users/${uid}/managedAssets`).get();
  return snapshot.docs.map((document) => document.data() as ManagedAssetIntent);
}

export async function getManagedAssetIntent(uid: string, assetId: string): Promise<ManagedAssetIntent | null> {
  if (!UUID_PATTERN.test(assetId)) return null;
  const snapshot = await intentRef(uid, assetId).get();
  return snapshot.exists ? snapshot.data() as ManagedAssetIntent : null;
}

function metadataMatches(intent: ManagedAssetIntent, physical: HeadBlobResult): boolean {
  return physical.pathname === intent.storagePath
    && physical.contentType === intent.contentType
    && physical.size === intent.expectedSizeBytes
    && typeof physical.etag === "string"
    && ETAG_PATTERN.test(physical.etag)
    && typeof physical.downloadUrl === "string"
    && physical.downloadUrl.length > 0;
}

export async function reconcileManagedAssetIntent(uid: string, assetId: string): Promise<ReconciledManagedAsset> {
  const intent = await getManagedAssetIntent(uid, assetId);
  if (!intent) return { status: "conflict" };

  let physical: HeadBlobResult;
  try {
    physical = await head(intent.storagePath);
  } catch (error) {
    const blobIsAbsent = error instanceof BlobNotFoundError;
    const ref = intentRef(uid, assetId);
    return firestore().runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(ref);
      if (!currentSnapshot.exists) return { status: "conflict" };
      const current = currentSnapshot.data() as ManagedAssetIntent & { leaseExpiresAt?: Timestamp };
      if (current.state === "complete" || current.state === "conflict") return { status: "conflict" };

      // The Blob check ran outside the transaction. If authorization advanced
      // the intent while that check was pending, this reconciliation is stale
      // and must not change the newly authorized operation's state.
      if (current.state !== intent.state) {
        if (current.state === "uploading") {
          return current.leaseExpiresAt instanceof Timestamp && current.leaseExpiresAt.toMillis() > Date.now()
            ? { status: "in_progress" }
            : { status: "uncertain" };
        }
        return { status: "uncertain" };
      }

      if (current.state === "pending" && blobIsAbsent) {
        return { status: "absent" };
      }
      if (current.state === "pending") {
        // No upload token has been issued for a pending intent. Preserve that
        // fact on provider failure and let a later request retry reconciliation.
        throw new ManagedAssetPhysicalCheckError();
      }
      if (current.state === "uploading" && blobIsAbsent && current.leaseExpiresAt instanceof Timestamp && current.leaseExpiresAt.toMillis() > Date.now()) {
        return { status: "in_progress" };
      }
      if (current.state !== "uncertain") {
        transaction.update(ref, { state: "uncertain", updatedAt: FieldValue.serverTimestamp() });
      }
      return { status: "uncertain" };
    });
  }

  if (!metadataMatches(intent, physical)) {
    const ref = intentRef(uid, assetId);
    return firestore().runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(ref);
      if (!currentSnapshot.exists) return { status: "conflict" };
      const current = currentSnapshot.data() as ManagedAssetIntent & { leaseExpiresAt?: Timestamp };
      if (!descriptorMatches(current as unknown as Record<string, unknown>, intent, intent.storagePath)) {
        return { status: "conflict" };
      }
      if (current.state !== intent.state) {
        if (current.state === "uploading") {
          return current.leaseExpiresAt instanceof Timestamp && current.leaseExpiresAt.toMillis() > Date.now()
            ? { status: "in_progress" }
            : { status: "uncertain" };
        }
        return { status: current.state === "uncertain" ? "uncertain" : "conflict" };
      }
      if (current.state === "complete" || current.state === "conflict") return { status: "conflict" };
      transaction.update(ref, { state: "conflict", updatedAt: FieldValue.serverTimestamp() });
      return { status: "conflict" };
    });
  }

  const result = {
    assetId,
    storagePath: intent.storagePath,
    downloadUrl: physical.downloadUrl,
    contentType: physical.contentType,
    sizeBytes: physical.size,
    etag: physical.etag,
  };
  const ref = intentRef(uid, assetId);
  const finalized = await firestore().runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(ref);
    if (!currentSnapshot.exists) return false;
    const current = currentSnapshot.data() as ManagedAssetIntent;
    if (!descriptorMatches(current as unknown as Record<string, unknown>, intent, intent.storagePath)) return false;
    if (current.state === "conflict") return false;
    if (current.state === "complete") {
      return current.downloadUrl === result.downloadUrl && current.etag === result.etag && current.sizeBytes === result.sizeBytes;
    }
    transaction.update(ref, {
      state: "complete",
      downloadUrl: result.downloadUrl,
      etag: result.etag,
      sizeBytes: result.sizeBytes,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      leaseExpiresAt: FieldValue.delete(),
    });
    return true;
  });
  return finalized ? { status: "complete", result } : { status: "conflict" };
}

export async function authorizeManagedAssetUpload(
  uid: string,
  assetId: string,
  storagePath: string,
  contentType: string,
  sizeBytes: number,
): Promise<"authorized" | "complete" | "in_progress" | "uncertain"> {
  const intent = await getManagedAssetIntent(uid, assetId);
  if (!intent || intent.storagePath !== storagePath || intent.contentType !== contentType || intent.expectedSizeBytes !== sizeBytes) {
    throw new Error("intent_mismatch");
  }
  const reconciled = await reconcileManagedAssetIntent(uid, assetId);
  if (reconciled.status === "complete") return "complete";
  if (reconciled.status === "in_progress") return "in_progress";
  if (reconciled.status === "uncertain") return "uncertain";
  if (reconciled.status !== "absent") throw new Error(reconciled.status === "conflict" ? "intent_conflict" : "physical_uncertain");

  const ref = intentRef(uid, assetId);
  return firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("intent_mismatch");
    const current = snapshot.data() as ManagedAssetIntent & { leaseExpiresAt?: Timestamp };
    if (!descriptorMatches(current as unknown as Record<string, unknown>, intent, storagePath)) throw new Error("intent_mismatch");
    if (current.state === "complete") return "complete";
    if (current.state === "conflict") throw new Error("intent_conflict");
    if (current.state === "uncertain") return "uncertain";
    if (current.state === "uploading") return "in_progress";
    if (current.state !== "pending") throw new Error("intent_conflict");
    transaction.update(ref, {
      state: "uploading",
      leaseExpiresAt: Timestamp.fromMillis(Date.now() + ACTIVE_UPLOAD_LEASE_MS),
      updatedAt: FieldValue.serverTimestamp(),
      attemptCount: FieldValue.increment(1),
    });
    return "authorized";
  });
}
