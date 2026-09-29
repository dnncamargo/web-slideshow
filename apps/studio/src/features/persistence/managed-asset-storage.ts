"use client";

import { upload } from "@vercel/blob/client";

import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseAuth } from "./firebase-client";
import {
  FirebaseAuthenticationError,
  ManagedAssetUploadError,
} from "./persistence-errors";

export interface ManagedAssetUploadResult {
  assetId: string;
  storagePath: string;
  downloadUrl: string;
  contentType: string;
  sizeBytes: number;
}

export interface ManagedAssetUploadOptions {
  contentType?: string;
}

function createAssetId(): string {
  return crypto.randomUUID();
}

export async function uploadManagedAsset(
  file: File,
  options: ManagedAssetUploadOptions = {},
): Promise<ManagedAssetUploadResult> {
  const user = requireAuthenticatedFirebaseUser(
    () => getFirebaseAuth().currentUser,
  );
  const assetId = createAssetId();
  const storagePath = `users/${user.uid}/assets/${assetId}`;
  const contentType = options.contentType ?? file.type;

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
    const blob = await upload(storagePath, file, {
      access: "public",
      clientPayload: JSON.stringify({ idToken, contentType }),
      contentType,
      handleUploadUrl: "/api/managed-assets/upload",
    });

    return {
      assetId,
      storagePath,
      downloadUrl: blob.url,
      contentType,
      sizeBytes: file.size,
    };
  } catch (error) {
    throw new ManagedAssetUploadError(
      "Failed to upload managed asset.",
      error,
    );
  }
}
