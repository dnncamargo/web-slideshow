"use client";

import { upload } from "@vercel/blob/client";
import { BlobContentTypeNotAllowedError } from "@vercel/blob";

import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseAuth } from "./firebase-client";
import {
  classifyManagedAssetFilename,
  type ManagedAssetContentType,
} from "./managed-asset-content-types";
import type { ManagedAssetUploadPurpose } from "./managed-asset-intents";
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
  /** Kept for callers that already pass classification; it must match the filename. */
  contentType?: ManagedAssetContentType;
}

export interface ManagedAssetUploadIntent {
  assetId: string;
  storagePath: string;
  originalFilename: string;
  extension: string;
  contentType: string;
  expectedSizeBytes: number;
  sourceLastModified: number;
  /** Missing only on intents persisted before upload purposes were introduced. */
  purpose?: ManagedAssetUploadPurpose;
  state: "pending" | "uploading" | "uncertain" | "complete" | "conflict" | "deleted";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createManagedAssetId(): string {
  return crypto.randomUUID();
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

async function listIntents(idToken: string): Promise<ManagedAssetUploadIntent[]> {
  const body = await authorizedRequest<{ intents: ManagedAssetUploadIntent[] }>(
    "/api/managed-assets/intents",
    idToken,
  );
  return body.intents;
}

function intentMatchesFile(
  intent: ManagedAssetUploadIntent,
  file: File,
  extension: string,
  contentType: string,
): boolean {
  return intent.originalFilename === file.name
    && intent.extension === extension
    && intent.contentType === contentType
    && intent.expectedSizeBytes === file.size
    && intent.sourceLastModified === file.lastModified;
}

function recoveryRequired(message: string): ManagedAssetUploadError {
  return new ManagedAssetUploadError(message, new TypeError("Explicit upload-intent recovery is required."));
}

export async function listManagedAssetUploadIntents(): Promise<ManagedAssetUploadIntent[]> {
  const user = requireAuthenticatedFirebaseUser(
    () => getFirebaseAuth().currentUser,
  );
  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch (error) {
    throw new FirebaseAuthenticationError("Failed to acquire a Firebase authentication token.", error);
  }
  try {
    return await listIntents(idToken);
  } catch (error) {
    if (error instanceof ManagedAssetUploadError) throw error;
    throw new ManagedAssetUploadError("Could not list managed asset upload intents.", error);
  }
}

async function runManagedAssetUpload(
  file: File,
  options: ManagedAssetUploadOptions,
  purpose: ManagedAssetUploadPurpose,
  resumeAssetId?: string,
): Promise<ManagedAssetUploadResult> {
  const user = requireAuthenticatedFirebaseUser(
    () => getFirebaseAuth().currentUser,
  );
  const classification = classifyManagedAssetFilename(file.name);
  const fontsExtension = classification?.extension === ".ttf" || classification?.extension === ".otf" || classification?.extension === ".woff2";
  if (
    classification === null
    || (purpose === "generic" && classification.category === "font")
    || (purpose === "fonts" && !fontsExtension)
    || (options.contentType !== undefined && options.contentType !== classification.contentType)
  ) {
    throw new ManagedAssetUploadError(
      "Unsupported managed asset file type.",
      new BlobContentTypeNotAllowedError("Unsupported or mismatched file extension and content type."),
    );
  }
  if (resumeAssetId !== undefined && !UUID_PATTERN.test(resumeAssetId)) {
    throw new ManagedAssetUploadError(
      "Invalid managed asset identity.",
      new Error("Managed asset ID must be a valid UUID."),
    );
  }
  const contentType = classification.contentType;
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
    const existingIntents = await listIntents(idToken);
    let selectedId = resumeAssetId;
    let selectedIntent: ManagedAssetUploadIntent | undefined;
    if (selectedId !== undefined) {
      selectedIntent = existingIntents.find((intent) => intent.assetId === selectedId);
      if (!selectedIntent) throw recoveryRequired("The selected upload operation no longer exists. Start a new upload instead.");
      if (!intentMatchesFile(selectedIntent, file, classification.extension, contentType)) {
        throw recoveryRequired("The selected file does not match this upload operation.");
      }
    } else {
      const unresolvedMatches = existingIntents.filter((intent) =>
        intentMatchesFile(intent, file, classification.extension, contentType)
        && (intent.state === "uploading" || intent.state === "uncertain"),
      );
      if (unresolvedMatches.length > 1) {
        throw recoveryRequired("Several matching upload operations need explicit recovery selection before starting another upload.");
      }
      if (unresolvedMatches.length === 1) {
        throw recoveryRequired("A matching upload operation may still be transferring. Select that operation to recover it before starting a new upload.");
      }
      selectedId = createManagedAssetId();
    }
    if (!UUID_PATTERN.test(selectedId)) {
      throw new ManagedAssetUploadError("Invalid managed asset identity.", new Error("Managed asset ID must be a valid UUID."));
    }

    const intentInput = {
      assetId: selectedId,
      originalFilename: file.name,
      extension: classification.extension,
      contentType,
      expectedSizeBytes: file.size,
      sourceLastModified: file.lastModified,
    };
    const storagePath = storagePathFor(selectedId);
    let prior = resumeAssetId === undefined ? undefined : await recoverIntent(idToken, selectedId);
    if (prior?.status === "complete" && prior.result) {
      return assertRecoveredResult(prior.result, selectedId, storagePath, contentType, file.size);
    }
    if (prior !== undefined && prior.status !== "absent") {
      throw recoveryRequired(`Upload operation status is ${prior.status}; it cannot start another physical transfer automatically.`);
    }
    if (resumeAssetId !== undefined && selectedIntent?.purpose === undefined) {
      throw recoveryRequired("This older upload operation has no recorded purpose. Start a new upload to create a fresh operation.");
    }
    await authorizedRequest<{ intent: ManagedAssetUploadIntent }>(
      purpose === "fonts" ? "/api/managed-assets/fonts/intents" : "/api/managed-assets/intents",
      idToken,
      { method: "POST", body: JSON.stringify(intentInput) },
    );
    prior ??= await recoverIntent(idToken, selectedId);
    if (prior.status === "complete" && prior.result) {
      return assertRecoveredResult(prior.result, selectedId, storagePath, contentType, file.size);
    }
    if (prior.status !== "absent") {
      throw recoveryRequired(`Upload operation status is ${prior.status}; it cannot start another physical transfer automatically.`);
    }

    try {
      await upload(storagePath, file, {
        access: "public",
        clientPayload: JSON.stringify({ idToken, contentType, assetId: selectedId, expectedSizeBytes: file.size, purpose }),
        contentType,
        handleUploadUrl: "/api/managed-assets/upload",
      });
    } catch (uploadError) {
      const recovered = await recoverIntent(idToken, selectedId).catch(() => null);
      if (recovered?.status === "complete" && recovered.result) {
        return assertRecoveredResult(recovered.result, selectedId, storagePath, contentType, file.size);
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
    return result;
  } catch (error) {
    if (error instanceof ManagedAssetUploadError) throw error;
    throw new ManagedAssetUploadError("Failed to upload managed asset.", error);
  }
}

/** Starts a distinct upload operation. Matching file descriptors never reuse an earlier asset ID. */
export function uploadManagedAsset(
  file: File,
  options: ManagedAssetUploadOptions = {},
): Promise<ManagedAssetUploadResult> {
  return runManagedAssetUpload(file, options, "generic");
}

/** Uploads a font using the dedicated server-side intent contract. */
export function uploadManagedFontAsset(
  file: File,
  options: ManagedAssetUploadOptions = {},
): Promise<ManagedAssetUploadResult> {
  return runManagedAssetUpload(file, options, "fonts");
}

/** Explicitly resumes or reconciles one previously selected server-side upload operation. */
export function resumeManagedAssetUpload(
  file: File,
  assetId: string,
  options: ManagedAssetUploadOptions = {},
): Promise<ManagedAssetUploadResult> {
  return runManagedAssetUpload(file, options, "generic", assetId);
}

/** Explicitly resumes one selected operation created through the Fonts flow. */
export function resumeManagedFontAssetUpload(
  file: File,
  assetId: string,
  options: ManagedAssetUploadOptions = {},
): Promise<ManagedAssetUploadResult> {
  return runManagedAssetUpload(file, options, "fonts", assetId);
}
