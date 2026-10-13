import { list, type ListBlobResult } from "@vercel/blob";

import { isManagedAssetControlPath } from "./managed-asset-control-path";
import { configuredManagedAssetStoreId } from "./managed-asset-blob-identity";
import { readManagedAssetDisplayNames } from "./managed-asset-controls";

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
  displayName?: string;
}

export class ManagedAssetInventoryAnnotationError extends Error {
  constructor() {
    super("Managed asset display names are unavailable.");
    this.name = "ManagedAssetInventoryAnnotationError";
  }
}

export interface ManagedAssetInventoryPage {
  scope: "owner";
  items: ManagedAssetInventoryItem[];
  hasMore: boolean;
  cursor?: string;
}

export function getEffectiveManagedAssetStoreId(): string {
  const storeId = configuredManagedAssetStoreId(
    process.env.BLOB_STORE_ID,
    process.env.BLOB_READ_WRITE_TOKEN,
  );
  if (!storeId) throw new Error("Managed asset storage is unavailable.");
  return storeId;
}

function assertConfiguration(storeId: string): void {
  if (!storeId || !(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim())) {
    throw new Error("Managed asset storage is unavailable.");
  }
}

export function isValidManagedAssetInventoryCursor(cursor: string | null): boolean {
  return cursor === null || (
    cursor.length > 0 && cursor.length <= MANAGED_ASSET_INVENTORY_CURSOR_MAX_LENGTH &&
    !/[\x00-\x1f\x7f]/.test(cursor)
  );
}

function isListResult(value: unknown): value is ListBlobResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return Array.isArray(result.blobs) && typeof result.hasMore === "boolean";
}

function validateBlob(value: unknown, prefix: string, seen: Set<string>): ManagedAssetInventoryItem {
  if (typeof value !== "object" || value === null) throw new Error("Invalid Blob metadata.");
  const blob = value as Record<string, unknown>;
  const date = blob.uploadedAt instanceof Date
    ? blob.uploadedAt
    : typeof blob.uploadedAt === "string" || typeof blob.uploadedAt === "number"
      ? new Date(blob.uploadedAt)
      : null;
  let url: URL;
  try { url = new URL(typeof blob.url === "string" ? blob.url : ""); }
  catch { throw new Error("Invalid Blob metadata."); }
  if (
    typeof blob.pathname !== "string" || !blob.pathname.startsWith(prefix) ||
    blob.pathname.length <= prefix.length || blob.pathname.length > MAX_PATHNAME_LENGTH ||
    /[\x00-\x1f\x7f]/.test(blob.pathname) || seen.has(blob.pathname) ||
    url.protocol !== "https:" || url.username || url.password ||
    typeof blob.url !== "string" || blob.url.length > 4096 ||
    typeof blob.size !== "number" || !Number.isSafeInteger(blob.size) || blob.size < 0 ||
    !(date instanceof Date) || !Number.isFinite(date.getTime()) ||
    typeof blob.etag !== "string" || !/^[^\s\u0000-\u001f\u007f]{1,512}$/.test(blob.etag)
  ) throw new Error("Invalid Blob metadata.");
  seen.add(blob.pathname);
  return { pathname: blob.pathname, url: blob.url, size: blob.size, uploadedAt: date.toISOString(), etag: blob.etag };
}

async function annotateItems(uid: string, items: ManagedAssetInventoryItem[]): Promise<ManagedAssetInventoryItem[]> {
  let names: Map<string, string>;
  const eligiblePaths = items.map((item) => item.pathname).filter((pathname) => isManagedAssetControlPath(uid, pathname));
  if (eligiblePaths.length === 0) {
    names = new Map();
  } else {
    try {
      names = await readManagedAssetDisplayNames(uid, eligiblePaths);
    } catch {
      throw new ManagedAssetInventoryAnnotationError();
    }
  }
  return items.map((item) => {
    const displayName = names.get(item.pathname);
    return displayName === undefined ? item : { ...item, displayName };
  });
}

function listWithCancellation(options: Parameters<typeof list>[0], signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      action();
    };
    const onAbort = () => finish(() => reject(new Error("Managed asset inventory request timed out.")));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    void list(options).then((result) => finish(() => resolve(result)), (error: unknown) => finish(() => reject(error)));
  });
}

export async function listManagedAssetInventoryPage(uid: string, cursor: string | null): Promise<ManagedAssetInventoryPage> {
  if (!uid.trim() || uid.includes("/") || !isValidManagedAssetInventoryCursor(cursor)) {
    throw new Error("Managed asset inventory request is invalid.");
  }
  const storeId = getEffectiveManagedAssetStoreId();
  assertConfiguration(storeId);
  const prefix = `users/${uid}/assets/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MANAGED_ASSET_INVENTORY_TIMEOUT_MS);
  try {
    const result: unknown = await listWithCancellation({
      mode: "expanded", prefix, limit: MANAGED_ASSET_INVENTORY_PAGE_SIZE, storeId,
      abortSignal: controller.signal, ...(cursor === null ? {} : { cursor }),
    }, controller.signal);
    if (!isListResult(result)) throw new Error("Invalid Blob listing.");
    const seen = new Set<string>();
    const items = await annotateItems(uid, result.blobs.map((blob) => validateBlob(blob, prefix, seen)));
    if (result.hasMore) {
      if (typeof result.cursor !== "string" || !isValidManagedAssetInventoryCursor(result.cursor) || result.cursor === cursor) {
        throw new Error("Invalid Blob pagination cursor.");
      }
      return { scope: "owner", items, hasMore: true, cursor: result.cursor };
    }
    return { scope: "owner", items, hasMore: false };
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

export async function getManagedAssetInventoryObject(uid: string, pathname: string): Promise<ManagedAssetInventoryItem | null> {
  if (!uid.trim() || uid.includes("/") || !pathname.startsWith(`users/${uid}/assets/`) || !isValidManagedAssetInventoryCursor(pathname)) {
    throw new Error("Managed asset inventory request is invalid.");
  }
  const storeId = getEffectiveManagedAssetStoreId();
  assertConfiguration(storeId);
  const prefix = `users/${uid}/assets/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MANAGED_ASSET_INVENTORY_TIMEOUT_MS);
  try {
    const result: unknown = await listWithCancellation({
      mode: "expanded", prefix: pathname, limit: MANAGED_ASSET_INVENTORY_PAGE_SIZE, storeId,
      abortSignal: controller.signal,
    }, controller.signal);
    if (!isListResult(result)) throw new Error("Invalid Blob listing.");
    const seen = new Set<string>();
    const items = result.blobs.map((blob) => validateBlob(blob, prefix, seen));
    const exact = items.find((item) => item.pathname === pathname);
    if (!exact) return null;
    return (await annotateItems(uid, [exact]))[0] ?? null;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
