import { BlobNotFoundError, head } from "@vercel/blob";

import { validateManagedAssetPath } from "./managed-asset-controls";
import { configuredManagedAssetStoreId, normalizeManagedAssetStoreId } from "./managed-asset-blob-identity";

export type ManagedAssetAvailabilityState = "available" | "missing" | "unknown";

export interface ManagedAssetAvailabilityResult {
  state: ManagedAssetAvailabilityState;
  storeId?: string;
}

export async function checkManagedAssetAvailability(
  uid: string,
  storagePath: string,
  expectedStoreId: string | null,
): Promise<ManagedAssetAvailabilityResult> {
  validateManagedAssetPath(uid, storagePath);

  const configuredStoreId = process.env.BLOB_STORE_ID?.trim();
  const storeId = configuredManagedAssetStoreId(configuredStoreId, process.env.BLOB_READ_WRITE_TOKEN);
  const expected = expectedStoreId ? normalizeManagedAssetStoreId(expectedStoreId) : null;
  const hasProviderCredential = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim(),
  );
  if (!storeId || !expected || storeId !== expected || !hasProviderCredential) return { state: "unknown" };

  try {
    const blob = await head(storagePath, { storeId });
    if (blob.pathname !== storagePath) return { state: "unknown", storeId };
    return { state: "available", storeId };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { state: "missing", storeId };
    return { state: "unknown", storeId };
  }
}
