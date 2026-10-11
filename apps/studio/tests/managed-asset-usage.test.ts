import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@vercel/blob", () => ({ list: blobMocks.list }));

import {
  clearOwnerBlobUsageCacheForTests,
  getOwnerBlobUsage,
  OWNER_USAGE_GLOBAL_TIMEOUT_MS,
  OWNER_USAGE_TTL_MS,
} from "../src/features/persistence/managed-asset-usage";

function page(blobs: Array<{ pathname: string; size: number }>, hasMore = false, cursor?: string) {
  return { blobs, hasMore, ...(cursor ? { cursor } : {}) };
}

beforeEach(() => {
  clearOwnerBlobUsageCacheForTests();
  vi.clearAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
  vi.stubEnv("BLOB_STORE_ID", "test-store");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("managed asset owner usage", () => {
  it("returns zero for an empty owner prefix", async () => {
    blobMocks.list.mockResolvedValueOnce(page([]));
    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({
      objectCount: 0,
      bytesUsed: 0,
      quotaStatus: "unknown",
    });
    expect(blobMocks.list).toHaveBeenCalledWith(expect.objectContaining({
      prefix: "users/owner-1/assets/",
      mode: "expanded",
    }));
  });

  it("aggregates multiple pages and physical orphans", async () => {
    blobMocks.list
      .mockResolvedValueOnce(page([
        { pathname: "users/owner-1/assets/a", size: 10 },
        { pathname: "users/owner-1/assets/orphan", size: 20 },
      ], true, "next"))
      .mockResolvedValueOnce(page([{ pathname: "users/owner-1/assets/b", size: 30 }]));

    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({
      objectCount: 3,
      bytesUsed: 60,
    });
    expect(blobMocks.list).toHaveBeenCalledTimes(2);
    expect(blobMocks.list.mock.calls[1]?.[0]).toMatchObject({ cursor: "next" });
  });

  it("fails safely on invalid pagination and never caches partial totals", async () => {
    blobMocks.list.mockResolvedValueOnce(page([{ pathname: "users/owner-1/assets/a", size: 10 }], true));
    await expect(getOwnerBlobUsage("owner-1")).rejects.toThrow();
    blobMocks.list.mockResolvedValueOnce(page([]));
    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({ objectCount: 0 });
  });

  it("rejects duplicate pathnames across pages and never caches a partial total", async () => {
    blobMocks.list
      .mockResolvedValueOnce(page([
        { pathname: "users/owner-1/assets/a", size: 10 },
      ], true, "next"))
      .mockResolvedValueOnce(page([
        { pathname: "users/owner-1/assets/a", size: 10 },
      ]));

    await expect(getOwnerBlobUsage("owner-1")).rejects.toThrow();
    blobMocks.list.mockResolvedValueOnce(page([
      { pathname: "users/owner-1/assets/fresh", size: 7 },
    ]));
    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({
      objectCount: 1,
      bytesUsed: 7,
    });
  });

  it("rejects a provider page that escapes the exact owner prefix", async () => {
    blobMocks.list.mockResolvedValueOnce(page([{ pathname: "users/other/assets/a", size: 10 }]));
    await expect(getOwnerBlobUsage("owner-1")).rejects.toThrow();
  });

  it("deduplicates concurrent requests per owner and separates owners", async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((r) => { resolve = r; });
    blobMocks.list.mockReturnValueOnce(pending).mockResolvedValueOnce(page([]));
    const first = getOwnerBlobUsage("owner-1");
    const second = getOwnerBlobUsage("owner-1");
    expect(first).toBe(second);
    resolve(page([]));
    await first;
    await getOwnerBlobUsage("owner-2");
    expect(blobMocks.list).toHaveBeenCalledTimes(2);
  });

  it("separates cache entries when the effective Blob Store changes", async () => {
    blobMocks.list
      .mockResolvedValueOnce(page([{ pathname: "users/owner-1/assets/a", size: 10 }]))
      .mockResolvedValueOnce(page([{ pathname: "users/owner-1/assets/a", size: 11 }]));

    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({ bytesUsed: 10 });
    vi.stubEnv("BLOB_STORE_ID", "other-store");
    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({ bytesUsed: 11 });
    expect(blobMocks.list).toHaveBeenCalledTimes(2);
  });

  it("aborts an active request at the global deadline and permits a clean retry", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(start);
    let callCount = 0;
    let activeSignal: AbortSignal | undefined;
    const originalSetTimeout = globalThis.setTimeout;
    // Keep the synthetic active request alive so the global timer, not the page timer, aborts it.
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((handler, delay, ...args) => (
      originalSetTimeout(
        handler,
        delay === 15_000 ? OWNER_USAGE_GLOBAL_TIMEOUT_MS + 1 : delay,
        ...args,
      )
    ));
    blobMocks.list.mockImplementation((options: { abortSignal?: AbortSignal }) => {
      callCount += 1;
      activeSignal = options.abortSignal;
      if (callCount <= 16) {
        return Promise.resolve(page([
          { pathname: `users/owner-1/assets/page-${callCount}`, size: 1 },
        ], true, `cursor-${callCount}`));
      }
      return new Promise((resolve) => {
        options.abortSignal?.addEventListener("abort", () => resolve(page([])), { once: true });
      });
    });

    const request = getOwnerBlobUsage("owner-1");
    const settled = request.then(
      () => null,
      (error: unknown) => error,
    );
    try {
      for (let tick = 0; tick < 32 && callCount < 17; tick += 1) await Promise.resolve();
      expect(callCount).toBe(17);
      await vi.advanceTimersByTimeAsync(OWNER_USAGE_GLOBAL_TIMEOUT_MS);

      const failure = await settled;
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toMatch(/timed out/i);
      expect(callCount).toBe(17);
      expect(activeSignal?.aborted).toBe(true);
    } finally {
      setTimeoutSpy.mockRestore();
    }

    blobMocks.list.mockResolvedValueOnce(page([]));
    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({
      objectCount: 0,
      bytesUsed: 0,
    });
    expect(blobMocks.list).toHaveBeenCalledTimes(18);
  });

  it("aborts a pending page at the per-page timeout without caching a failure", async () => {
    vi.useFakeTimers();
    let activeSignal: AbortSignal | undefined;
    blobMocks.list.mockImplementation((options: { abortSignal?: AbortSignal }) => {
      activeSignal = options.abortSignal;
      return new Promise((resolve) => {
        options.abortSignal?.addEventListener("abort", () => resolve(page([])), { once: true });
      });
    });

    const request = getOwnerBlobUsage("owner-1");
    const settled = request.then(
      () => null,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(15_000);
    const failure = await settled;
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/cancelled/i);
    expect(activeSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    blobMocks.list.mockResolvedValueOnce(page([{ pathname: "users/owner-1/assets/retry", size: 4 }]));
    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({
      objectCount: 1,
      bytesUsed: 4,
    });
  });

  it("reuses results within the TTL and recomputes after expiration", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(start);
    blobMocks.list
      .mockResolvedValueOnce(page([{ pathname: "users/owner-1/assets/a", size: 10 }]))
      .mockResolvedValueOnce(page([{ pathname: "users/owner-1/assets/b", size: 20 }]));

    const first = await getOwnerBlobUsage("owner-1");
    await vi.advanceTimersByTimeAsync(OWNER_USAGE_TTL_MS - 1);
    await expect(getOwnerBlobUsage("owner-1")).resolves.toEqual(first);
    expect(blobMocks.list).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2);
    const refreshed = await getOwnerBlobUsage("owner-1");
    expect(refreshed.bytesUsed).toBe(20);
    expect(refreshed.measuredAt).not.toBe(first.measuredAt);
    expect(blobMocks.list).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used identity while retaining a refreshed entry", async () => {
    blobMocks.list.mockImplementation((options: { prefix?: string }) => {
      return Promise.resolve(page([{
        pathname: `${options.prefix ?? "users/owner-0/assets/"}asset`,
        size: 1,
      }]));
    });

    for (let ownerNumber = 0; ownerNumber < 128; ownerNumber += 1) {
      await getOwnerBlobUsage(`owner-${ownerNumber}`);
    }
    expect(blobMocks.list).toHaveBeenCalledTimes(128);

    await getOwnerBlobUsage("owner-0");
    await getOwnerBlobUsage("owner-128");
    await getOwnerBlobUsage("owner-1");
    expect(blobMocks.list).toHaveBeenCalledTimes(130);

    await expect(getOwnerBlobUsage("owner-0")).resolves.toMatchObject({ bytesUsed: 1 });
    expect(blobMocks.list).toHaveBeenCalledTimes(130);
  });

  it("shares concurrent provider failures and retries after rejection", async () => {
    let rejectList!: (error: unknown) => void;
    blobMocks.list.mockReturnValueOnce(new Promise((_resolve, reject) => {
      rejectList = reject;
    }));

    const first = getOwnerBlobUsage("owner-1");
    const second = getOwnerBlobUsage("owner-1");
    expect(first).toBe(second);
    rejectList(new Error("provider unavailable"));

    const results = await Promise.allSettled([first, second]);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(blobMocks.list).toHaveBeenCalledTimes(1);

    blobMocks.list.mockResolvedValueOnce(page([{ pathname: "users/owner-1/assets/retry", size: 9 }]));
    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({
      objectCount: 1,
      bytesUsed: 9,
    });
    expect(blobMocks.list).toHaveBeenCalledTimes(2);
  });

  it("stops before the next page at the global deadline and allows a later retry", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(start);
    let callCount = 0;
    blobMocks.list.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        queueMicrotask(() => {
          vi.setSystemTime(start.getTime() + OWNER_USAGE_GLOBAL_TIMEOUT_MS);
        });
        return Promise.resolve(page([
          { pathname: "users/owner-1/assets/a", size: 10 },
        ], true, "next"));
      }
      throw new Error("next page must not be requested after the deadline");
    });

    await expect(getOwnerBlobUsage("owner-1")).rejects.toThrow(/timed out/i);
    expect(callCount).toBe(1);

    vi.setSystemTime(start.getTime() + OWNER_USAGE_GLOBAL_TIMEOUT_MS + 1);
    blobMocks.list.mockResolvedValueOnce(page([]));
    await expect(getOwnerBlobUsage("owner-1")).resolves.toMatchObject({
      objectCount: 0,
      bytesUsed: 0,
    });
    expect(blobMocks.list).toHaveBeenCalledTimes(2);
  });
});
