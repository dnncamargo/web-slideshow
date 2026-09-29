"use client";

import { getDownloadURL, ref, uploadBytes, type UploadMetadata } from "firebase/storage";

import { requireAuthenticatedFirebaseUser } from "./authenticated-user";
import { getFirebaseAuth, getFirebaseStorage } from "./firebase-client";
import { FirebaseStorageOperationError } from "./persistence-errors";

export interface ManagedAssetUploadResult {
  assetId: string;
  storagePath: string;
  downloadUrl: string;
  contentType: string;
  sizeBytes: number;
}

function createAssetId(): string {
  return crypto.randomUUID();
}

export async function uploadManagedAsset(
  file: File,
): Promise<ManagedAssetUploadResult> {
  const user = requireAuthenticatedFirebaseUser(
    () => getFirebaseAuth().currentUser,
  );
  const assetId = createAssetId();
  const storagePath = `users/${user.uid}/assets/${assetId}`;
  const storageRef = ref(getFirebaseStorage(), storagePath);
  const metadata: UploadMetadata = {};

  if (file.type) {
    metadata.contentType = file.type;
  }

  try {
    await uploadBytes(storageRef, file, metadata);
    const downloadUrl = await getDownloadURL(storageRef);

    return {
      assetId,
      storagePath,
      downloadUrl,
      contentType: file.type,
      sizeBytes: file.size,
    };
  } catch (error) {
    throw new FirebaseStorageOperationError(
      "Failed to upload managed asset.",
      error,
    );
  }
}
