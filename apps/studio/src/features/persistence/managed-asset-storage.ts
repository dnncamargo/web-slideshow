"use client";

import { upload } from "@vercel/blob/client";
import { BlobContentTypeNotAllowedError } from "@vercel/blob";

import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseAuth } from "./firebase-client";
import {
  classifyManagedAssetFilename,
  type ManagedAssetContentType,
} from "./managed-asset-content-types";
import {
  FirebaseAuthenticationError,
  ManagedAssetUploadError,
} from "./persistence-errors";

export interface ManagedAssetUploadResult {
  assetId: string;
  storagePath: string;
  downloadUrl: string;
  contentType: ManagedAssetContentType;
  sizeBytes: number;
  etag: string;
}

export interface ManagedAssetUploadOptions {
  /** Reuse this ID when retrying the same authorized upload operation. */
  assetId?: string;
  /** Kept for callers that already pass classification; it must match the filename. */
  contentType?: ManagedAssetContentType;
}

interface ManagedAssetIntentResponse {
  assetId: string;
  storagePath: string;
  originalFilename: string;
  extension: string;
  contentType: string;
  expectedSizeBytes: number;
  sourceLastModified: number;
  state: "pending" | "uploading" | "complete" | "conflict";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createManagedAssetId(): string {
  return crypto.randomUUID();
}

function browserIntentKey(uid: string, file: File, contentType: string): string {
  return `managed-asset-intent:${encodeURIComponent(uid)}:${encodeURIComponent(file.name)}:${file.size}:${file.lastModified}:${contentType}`;
}

async function authorizedRequest<T>(url: string, idToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(init?.headers ?? {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new ManagedAssetUploadError("Managed asset recovery is unavailable.", new TypeError(`Intent request failed with ${response.status}.`));
  return await response.json() as T;
}

function completeResult(value: unknown): ManagedAssetUploadResult | null {
  if (typeof value !== "object" || value === null) return null;
  const result = value as Record<string, unknown>;
  return typeof result.assetId === "string"
    && typeof result.storagePath === "string"
    && typeof result.downloadUrl === "string"
    && typeof result.contentType === "string"
    && typeof result.sizeBytes === "number"
    && typeof result.etag === "string"
    && /^[^\s\u0000-\u001f\u007f]{1,512}$/.test(result.etag)
    ? result as unknown as ManagedAssetUploadResult
    : null;
}

function assertRecoveredResult(
  result: ManagedAssetUploadResult,
  assetId: string,
  storagePath: string,
  contentType: string,
  sizeBytes: number,
): ManagedAssetUploadResult {
  if (
    result.assetId !== assetId
    || result.storagePath !== storagePath
    || result.contentType !== contentType
    || result.sizeBytes !== sizeBytes
  ) {
    throw new TypeError("Recovered upload metadata does not match the authorized intent.");
  }
  return result;
}

async function recoverIntent(idToken: string, assetId: string): Promise<{
  status: "absent" | "in_progress" | "complete" | "conflict" | "uncertain";
  result?: ManagedAssetUploadResult;
}> {
  const body = await authorizedRequest<{ status: "absent" | "in_progress" | "complete" | "conflict" | "uncertain"; result?: unknown }>(
    "/api/managed-assets/recover",
    idToken,
    { method: "POST", body: JSON.stringify({ assetId }) },
  );
  return { status: body.status, ...(completeResult(body.result) ? { result: completeResult(body.result)! } : {}) };
}

export async function uploadManagedAsset(
  file: File,
  options: ManagedAssetUploadOptions = {},
): Promise<ManagedAssetUploadResult> {
  const user = requireAuthenticatedFirebaseUser(
    () => getFirebaseAuth().currentUser,
  );
  const classification = classifyManagedAssetFilename(file.name);
  if (classification === null || (options.contentType !== undefined && options.contentType !== classification.contentType)) {
    throw new ManagedAssetUploadError(
      "Unsupported managed asset file type.",
      new BlobContentTypeNotAllowedError("Unsupported or mismatched file extension and content type."),
    );
  }
  let resolvedAssetId = options.assetId;
  if (resolvedAssetId !== undefined && !UUID_PATTERN.test(resolvedAssetId)) {
    throw new ManagedAssetUploadError(
      "Invalid managed asset identity.",
      new Error("Managed asset ID must be a valid UUID."),
    );
  }
  const contentType = classification.contentType;
  const intentKey = browserIntentKey(user.uid, file, contentType);
  const storagePathFor = (id: string) => `users/${user.uid}/assets/${id}${classification.extension}`;

  let idToken: string;

  try {
    idToken = await user.getIdToken();
  } catch (error) {
    throw new FirebaseAuthenticationError(
      "Failed to acquire a Firebase authentication token.",
      error,
    );
  }

  try {
    if (resolvedAssetId === undefined) {
      try { resolvedAssetId = window.localStorage.getItem(intentKey) ?? undefined; } catch { /* Server intent discovery remains available. */ }
    }
    const existing = await authorizedRequest<{ intents: ManagedAssetIntentResponse[] }>(
      "/api/managed-assets/intents",
      idToken,
    );
    const matching = existing.intents.filter((intent) =>
      intent.originalFilename === file.name
      && intent.extension === classification.extension
      && intent.contentType === contentType
      && intent.expectedSizeBytes === file.size
      && intent.sourceLastModified === file.lastModified,
    );
    if (resolvedAssetId === undefined) {
      const resumable = matching.filter((intent) => intent.state !== "conflict");
      if (resumable.length > 1) {
        throw new ManagedAssetUploadError("More than one matching upload intent needs recovery.", new TypeError("Ambiguous managed asset intent."));
      }
      resolvedAssetId = resumable[0]?.assetId;
    }
    const selectedId = resolvedAssetId ?? createManagedAssetId();
    if (!UUID_PATTERN.test(selectedId)) {
      throw new ManagedAssetUploadError("Invalid managed asset identity.", new Error("Managed asset ID must be a valid UUID."));
    }
    resolvedAssetId = selectedId;
    try { window.localStorage.setItem(intentKey, selectedId); } catch { /* The server intent remains durable. */ }

    const intentInput = {
      assetId: selectedId,
      originalFilename: file.name,
      extension: classification.extension,
      contentType,
      expectedSizeBytes: file.size,
      sourceLastModified: file.lastModified,
    };
    await authorizedRequest<{ intent: ManagedAssetIntentResponse }>(
      "/api/managed-assets/intents",
      idToken,
      { method: "POST", body: JSON.stringify(intentInput) },
    );

    const storagePath = storagePathFor(selectedId);
    const prior = await recoverIntent(idToken, selectedId);
    if (prior.status === "complete" && prior.result) {
      const result = assertRecoveredResult(prior.result, selectedId, storagePath, contentType, file.size);
      try { window.localStorage.removeItem(intentKey); } catch { /* Ignore unavailable local storage. */ }
      return result;
    }
    if (prior.status !== "absent") {
      throw new ManagedAssetUploadError("Managed asset upload needs recovery before retrying.", new TypeError(`Upload intent status: ${prior.status}.`));
    }

    try {
      await upload(storagePath, file, {
        access: "public",
        clientPayload: JSON.stringify({ idToken, contentType, assetId: selectedId, expectedSizeBytes: file.size }),
        contentType,
        handleUploadUrl: "/api/managed-assets/upload",
      });
    } catch (uploadError) {
      const recovered = await recoverIntent(idToken, selectedId).catch(() => null);
      if (recovered?.status === "complete" && recovered.result) {
        const result = assertRecoveredResult(recovered.result, selectedId, storagePath, contentType, file.size);
        try { window.localStorage.removeItem(intentKey); } catch { /* Ignore unavailable local storage. */ }
        return result;
      }
      throw uploadError;
    }

    // The SDK response is not the authoritative metadata source. The server
    // reconciles the physical object and supplies its verified ETag and size.
    const completed = await recoverIntent(idToken, selectedId);
    if (completed.status !== "complete" || !completed.result) {
      throw new TypeError(`Physical upload could not be verified (${completed.status}).`);
    }
    const result = assertRecoveredResult(completed.result, selectedId, storagePath, contentType, file.size);
    try { window.localStorage.removeItem(intentKey); } catch { /* Ignore unavailable local storage. */ }
    return result;
  } catch (error) {
    if (error instanceof ManagedAssetUploadError) throw error;
    throw new ManagedAssetUploadError("Failed to upload managed asset.", error);
  }
}
