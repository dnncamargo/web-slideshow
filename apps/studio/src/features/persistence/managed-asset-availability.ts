import { BlobNotFoundError, head } from "@vercel/blob";

import { validateManagedAssetPath } from "./managed-asset-controls";

export type ManagedAssetAvailabilityState = "available" | "missing" | "unknown";

export interface ManagedAssetAvailabilityResult {
  state: ManagedAssetAvailabilityState;
  storeId?: string;
}

export async function checkManagedAssetAvailability(
  uid: string,
  storagePath: string,
): Promise<ManagedAssetAvailabilityResult> {
  validateManagedAssetPath(uid, storagePath);

  const storeId = process.env.BLOB_STORE_ID?.trim();
  const hasProviderCredential = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim(),
  );
  if (!storeId || !hasProviderCredential) return { state: "unknown" };

  try {
    const blob = await head(storagePath, { storeId });
    if (blob.pathname !== storagePath) return { state: "unknown", storeId };
    return { state: "available", storeId };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { state: "missing", storeId };
    return { state: "unknown", storeId };
  }
}
