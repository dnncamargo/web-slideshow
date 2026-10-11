import { list, type ListBlobResult } from "@vercel/blob";

export const MANAGED_ASSET_INVENTORY_PAGE_SIZE = 100;
export const MANAGED_ASSET_INVENTORY_CURSOR_MAX_LENGTH = 4096;
export const MANAGED_ASSET_INVENTORY_TIMEOUT_MS = 15_000;
const MAX_PATHNAME_LENGTH = 2048;

export interface ManagedAssetInventoryItem {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
  etag: string;
}

export interface ManagedAssetInventoryPage {
  scope: "owner";
  items: ManagedAssetInventoryItem[];
  hasMore: boolean;
  cursor?: string;
}

function getEffectiveStoreId(): string {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!storeId) throw new Error("Managed asset storage is unavailable.");
  return storeId;
}

function assertConfiguration(storeId: string): void {
  const hasToken = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim(),
  );

  if (!hasToken || !storeId) {
    throw new Error("Managed asset storage is unavailable.");
  }
}

export function isValidManagedAssetInventoryCursor(cursor: string | null): boolean {
  return cursor === null || (
    cursor.length > 0 &&
    cursor.length <= MANAGED_ASSET_INVENTORY_CURSOR_MAX_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(cursor)
  );
}

function isListResult(value: unknown): value is ListBlobResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return Array.isArray(result.blobs) && typeof result.hasMore === "boolean";
}

function validateBlob(
  value: unknown,
  prefix: string,
  seenPathnames: Set<string>,
): ManagedAssetInventoryItem {
  if (typeof value !== "object" || value === null) {
    throw new Error("Managed asset storage returned invalid metadata.");
  }

  const blob = value as Record<string, unknown>;
  const uploadedAt = blob.uploadedAt;
  const uploadedAtDate = uploadedAt instanceof Date
    ? uploadedAt
    : typeof uploadedAt === "string" || typeof uploadedAt === "number"
      ? new Date(uploadedAt)
      : null;

  if (
    typeof blob.pathname !== "string" ||
    !blob.pathname.startsWith(prefix) ||
    blob.pathname.length <= prefix.length ||
    blob.pathname.length > MAX_PATHNAME_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(blob.pathname) ||
    typeof blob.url !== "string" ||
    blob.url.length === 0 ||
    blob.url.length > 4096 ||
    typeof blob.size !== "number" ||
    !Number.isSafeInteger(blob.size) ||
    blob.size < 0 ||
    !(uploadedAtDate instanceof Date) ||
    !Number.isFinite(uploadedAtDate.getTime()) ||
    typeof blob.etag !== "string" ||
    blob.etag.length === 0 ||
    blob.etag.length > 512 ||
    seenPathnames.has(blob.pathname)
  ) {
    throw new Error("Managed asset storage returned invalid metadata.");
  }

  let url: URL;
  try {
    url = new URL(blob.url);
  } catch {
    throw new Error("Managed asset storage returned invalid metadata.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Managed asset storage returned invalid metadata.");
  }

  seenPathnames.add(blob.pathname);
  return {
    pathname: blob.pathname,
    url: blob.url,
    size: blob.size,
    uploadedAt: uploadedAtDate.toISOString(),
    etag: blob.etag,
  };
}

function listWithCancellation(
  options: Parameters<typeof list>[0],
  signal: AbortSignal,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Managed asset inventory request timed out."));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });

    void list(options).then(
      (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

export async function listManagedAssetInventoryPage(
  uid: string,
  cursor: string | null,
): Promise<ManagedAssetInventoryPage> {
  if (!uid.trim() || !isValidManagedAssetInventoryCursor(cursor)) {
    throw new Error("Managed asset inventory request is invalid.");
  }

  const storeId = getEffectiveStoreId();
  assertConfiguration(storeId);
  const prefix = `users/${uid}/assets/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MANAGED_ASSET_INVENTORY_TIMEOUT_MS);

  try {
    const result: unknown = await listWithCancellation({
      mode: "expanded",
      prefix,
      limit: MANAGED_ASSET_INVENTORY_PAGE_SIZE,
      storeId,
      abortSignal: controller.signal,
      ...(cursor === null ? {} : { cursor }),
    }, controller.signal);

    if (!isListResult(result)) {
      throw new Error("Managed asset storage returned an invalid listing.");
    }

    const seenPathnames = new Set<string>();
    const items = result.blobs.map((blob) => validateBlob(blob, prefix, seenPathnames));
    if (result.hasMore) {
      if (
        typeof result.cursor !== "string" ||
        !isValidManagedAssetInventoryCursor(result.cursor) ||
        result.cursor === cursor
      ) {
        throw new Error("Managed asset listing pagination is invalid.");
      }
      return { scope: "owner", items, hasMore: true, cursor: result.cursor };
    }

    if (result.cursor !== undefined && typeof result.cursor !== "string") {
      throw new Error("Managed asset listing pagination is invalid.");
    }
    return { scope: "owner", items, hasMore: false };
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
