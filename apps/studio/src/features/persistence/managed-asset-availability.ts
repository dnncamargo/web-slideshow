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
  const readWriteToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  const storeId = configuredManagedAssetStoreId(configuredStoreId, readWriteToken);
  const expected = expectedStoreId ? normalizeManagedAssetStoreId(expectedStoreId) : null;
  const hasProviderCredential = Boolean(readWriteToken || oidcToken);
  if (!storeId || !expected || storeId.toLowerCase() !== expected.toLowerCase() || !hasProviderCredential) {
    return { state: "unknown" };
  }
  const options = readWriteToken
    ? { token: readWriteToken }
    : oidcToken
      ? { storeId, oidcToken }
      : null;
  if (!options) return { state: "unknown" };

  try {
    const blob = await head(storagePath, options);
    if (blob.pathname !== storagePath) return { state: "unknown", storeId: expected };
    return { state: "available", storeId: expected };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { state: "missing", storeId: expected };
    return { state: "unknown", storeId: expected };
  }
}
