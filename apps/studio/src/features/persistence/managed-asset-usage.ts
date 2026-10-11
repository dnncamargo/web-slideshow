import { list, type ListBlobResult } from "@vercel/blob";

export const OWNER_USAGE_TTL_MS = 15 * 60 * 1000;
export const OWNER_USAGE_MAX_CACHE_ENTRIES = 128;
/**
 * Vercel Node.js Functions have a 300 s default/max duration on Hobby.
 * Keep this aggregation below that ceiling so the request can authenticate,
 * serialize the response, and shut down cleanly.
 */
export const OWNER_USAGE_GLOBAL_TIMEOUT_MS = 240_000;
const LIST_PAGE_SIZE = 1000;
const MAX_PAGES = 100;
const MAX_OBJECTS = LIST_PAGE_SIZE * MAX_PAGES;
const PAGE_TIMEOUT_MS = 15_000;

export interface OwnerBlobUsage {
  scope: "owner";
  objectCount: number;
  bytesUsed: number;
  measuredAt: string;
  quotaStatus: "unknown";
}

interface CacheEntry {
  value: OwnerBlobUsage;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<OwnerBlobUsage>>();

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

function isListResult(value: unknown): value is ListBlobResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return Array.isArray(result.blobs) && typeof result.hasMore === "boolean";
}

function validatePage(result: ListBlobResult, prefix: string, seenPathnames: Set<string>): void {
  for (const blob of result.blobs) {
    if (
      typeof blob !== "object" ||
      blob === null ||
      typeof blob.pathname !== "string" ||
      !blob.pathname.startsWith(prefix) ||
      typeof blob.size !== "number" ||
      !Number.isSafeInteger(blob.size) ||
      blob.size < 0
    ) {
      throw new Error("Managed asset storage returned invalid metadata.");
    }
    if (seenPathnames.has(blob.pathname)) {
      throw new Error("Managed asset storage returned duplicate metadata.");
    }
    seenPathnames.add(blob.pathname);
  }
}

function remember(cacheKey: string, value: OwnerBlobUsage, now: number): void {
  cache.delete(cacheKey);
  cache.set(cacheKey, { value, expiresAt: now + OWNER_USAGE_TTL_MS });
  while (cache.size > OWNER_USAGE_MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function listWithCancellation(options: Parameters<typeof list>[0], signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Managed asset storage request was cancelled."));
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

async function measureOwnerBlobUsage(uid: string, storeId: string): Promise<OwnerBlobUsage> {
  assertConfiguration(storeId);
  const prefix = `users/${uid}/assets/`;
  const seenCursors = new Set<string>();
  const seenPathnames = new Set<string>();
  let cursor: string | undefined;
  let objectCount = 0;
  let bytesUsed = 0;
  const deadline = Date.now() + OWNER_USAGE_GLOBAL_TIMEOUT_MS;
  let activeController: AbortController | null = null;
  let globalExpired = false;
  const globalTimeout = setTimeout(() => {
    globalExpired = true;
    activeController?.abort();
  }, OWNER_USAGE_GLOBAL_TIMEOUT_MS);

  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const remaining = deadline - Date.now();
      if (globalExpired || remaining <= 0) {
        throw new Error("Managed asset storage measurement timed out.");
      }

      const abortController = new AbortController();
      activeController = abortController;
      const timeout = setTimeout(
        () => abortController.abort(),
        Math.min(PAGE_TIMEOUT_MS, remaining),
      );
      let result: unknown;
      try {
        result = await listWithCancellation({
          mode: "expanded",
          prefix,
          limit: LIST_PAGE_SIZE,
          abortSignal: abortController.signal,
          storeId,
          ...(cursor ? { cursor } : {}),
        }, abortController.signal);
      } catch (error) {
        if (globalExpired || Date.now() >= deadline) {
          throw new Error("Managed asset storage measurement timed out.");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        if (activeController === abortController) activeController = null;
      }

      if (globalExpired || Date.now() >= deadline) {
        throw new Error("Managed asset storage measurement timed out.");
      }
      if (!isListResult(result)) {
        throw new Error("Managed asset storage returned an invalid listing.");
      }
      validatePage(result, prefix, seenPathnames);

      objectCount += result.blobs.length;
      if (objectCount > MAX_OBJECTS) {
        throw new Error("Managed asset listing exceeded the safety limit.");
      }

      for (const blob of result.blobs) {
        bytesUsed += blob.size;
        if (!Number.isSafeInteger(bytesUsed)) {
          throw new Error("Managed asset usage exceeded the numeric safety limit.");
        }
      }

      if (!result.hasMore) {
        return {
          scope: "owner",
          objectCount,
          bytesUsed,
          measuredAt: new Date().toISOString(),
          quotaStatus: "unknown",
        };
      }

      if (typeof result.cursor !== "string" || !result.cursor || seenCursors.has(result.cursor)) {
        throw new Error("Managed asset listing pagination is invalid.");
      }
      seenCursors.add(result.cursor);
      cursor = result.cursor;
    }
  } finally {
    clearTimeout(globalTimeout);
    activeController?.abort();
  }

  throw new Error("Managed asset listing exceeded the page limit.");
}

export function getOwnerBlobUsage(uid: string): Promise<OwnerBlobUsage> {
  const storeId = getEffectiveStoreId();
  const cacheKey = `${storeId}\u0000${uid}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return Promise.resolve(cached.value);
  }
  if (cached) cache.delete(cacheKey);

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const request = measureOwnerBlobUsage(uid, storeId)
    .then((value) => {
      remember(cacheKey, value, Date.now());
      return value;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });
  inFlight.set(cacheKey, request);
  return request;
}

export function clearOwnerBlobUsageCacheForTests(): void {
  cache.clear();
  inFlight.clear();
}
