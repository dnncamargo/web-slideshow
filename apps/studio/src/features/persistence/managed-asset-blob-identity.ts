const PUBLIC_BLOB_SUFFIX = ".public.blob.vercel-storage.com";
const STORE_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

export interface ManagedAssetBlobIdentity {
  storeId: string;
  storagePath: string;
}

export function normalizeManagedAssetStoreId(value: string): string | null {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith("store_") ? trimmed.slice("store_".length) : trimmed;
  return normalized && STORE_LABEL_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Resolve the Store selected by the application's Blob credentials.
 *
 * The Blob SDK derives the Store from a read/write token, so BLOB_STORE_ID is
 * authoritative only when it agrees with that token. OIDC-only deployments
 * continue to use the explicitly configured Store ID.
 */
export function configuredManagedAssetStoreId(
  configuredStoreId: string | undefined,
  readWriteToken: string | undefined,
): string | null {
  const configured = configuredStoreId ? normalizeManagedAssetStoreId(configuredStoreId) : null;
  if (!configured) return null;
  if (!readWriteToken?.trim()) return configured;

  const tokenParts = readWriteToken.trim().split("_");
  if (tokenParts.slice(0, 3).join("_") !== "vercel_blob_rw" || !tokenParts[3]) return null;
  const tokenStoreId = normalizeManagedAssetStoreId(tokenParts[3]);
  return tokenStoreId === configured ? configured : null;
}

export function managedAssetBlobIdentityFromUrl(value: string): ManagedAssetBlobIdentity | null {
  try {
    const url = new URL(value);
    // The SDK interpolates the provider Store ID into its returned URL; URL.hostname then lowercases that DNS label.
    const rawAuthority = /^https:\/\/([^/?#]+)/i.exec(value)?.[1];
    if (!rawAuthority || rawAuthority.includes("@") || rawAuthority.includes(":")) return null;
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port
      || !hostname.endsWith(PUBLIC_BLOB_SUFFIX)) return null;

    const normalizedRawAuthority = rawAuthority.toLowerCase();
    if (!normalizedRawAuthority.endsWith(PUBLIC_BLOB_SUFFIX)) return null;
    const storeLabel = rawAuthority.slice(0, -PUBLIC_BLOB_SUFFIX.length);
    if (storeLabel.includes("_")) return null;
    const storeId = normalizeManagedAssetStoreId(storeLabel);
    if (!storeId) return null;

    const storagePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!storagePath) return null;
    return { storeId, storagePath };
  } catch {
    return null;
  }
}
