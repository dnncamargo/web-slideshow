import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@vercel/blob", () => ({ list: blobMocks.list }));

import {
  isValidManagedAssetInventoryCursor,
  listManagedAssetInventoryPage,
  MANAGED_ASSET_INVENTORY_PAGE_SIZE,
  MANAGED_ASSET_INVENTORY_TIMEOUT_MS,
} from "../src/features/persistence/managed-asset-inventory";

const validBlob = (pathname = "users/owner-1/assets/asset-1") => ({
  pathname,
  url: "https://blob.example/asset-1",
  downloadUrl: "https://blob.example/asset-1?download=1",
  size: 42,
  uploadedAt: new Date("2026-02-03T04:05:06.000Z"),
  etag: "etag-1",
});

function page(blobs: unknown[], hasMore = false, cursor?: string) {
  return { blobs, hasMore, ...(cursor === undefined ? {} : { cursor }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
  vi.stubEnv("BLOB_STORE_ID", "test-store");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("managed asset inventory listing", () => {
  it("lists one bounded page for the verified owner prefix and returns physical metadata", async () => {
    blobMocks.list.mockResolvedValueOnce(page([validBlob()]));

    await expect(listManagedAssetInventoryPage("owner-1", null)).resolves.toEqual({
      scope: "owner",
      items: [{
        pathname: "users/owner-1/assets/asset-1",
        url: "https://blob.example/asset-1",
        size: 42,
        uploadedAt: "2026-02-03T04:05:06.000Z",
        etag: "etag-1",
      }],
      hasMore: false,
    });
    expect(blobMocks.list).toHaveBeenCalledTimes(1);
    expect(blobMocks.list).toHaveBeenCalledWith(expect.objectContaining({
      prefix: "users/owner-1/assets/",
      mode: "expanded",
      limit: MANAGED_ASSET_INVENTORY_PAGE_SIZE,
      storeId: "test-store",
    }));
    expect(blobMocks.list.mock.calls[0]?.[0]).not.toHaveProperty("cursor");
  });

  it("passes an opaque cursor and validates the next-page boundary", async () => {
    blobMocks.list.mockResolvedValueOnce(page([validBlob()], true, "next-page"));
    await expect(listManagedAssetInventoryPage("owner-1", "page-1")).resolves.toMatchObject({
      hasMore: true,
      cursor: "next-page",
    });
    expect(blobMocks.list).toHaveBeenCalledWith(expect.objectContaining({
      prefix: "users/owner-1/assets/",
      cursor: "page-1",
    }));

    blobMocks.list.mockResolvedValueOnce(page([], true));
    await expect(listManagedAssetInventoryPage("owner-1", "page-1")).rejects.toThrow(/pagination/i);
  });

  it("returns an empty page without a cursor", async () => {
    blobMocks.list.mockResolvedValueOnce(page([]));
    await expect(listManagedAssetInventoryPage("owner-1", null)).resolves.toEqual({
      scope: "owner",
      items: [],
      hasMore: false,
    });
  });

  it.each([
    { ...validBlob(), pathname: "users/owner-2/assets/other-owner" },
    { ...validBlob(), size: -1 },
    { ...validBlob(), size: Number.MAX_SAFE_INTEGER + 1 },
    { ...validBlob(), uploadedAt: new Date(Number.NaN) },
    { ...validBlob(), etag: "" },
    { ...validBlob(), url: "javascript:alert(1)" },
  ])("rejects invalid provider metadata", async (blob) => {
    blobMocks.list.mockResolvedValueOnce(page([blob]));
    await expect(listManagedAssetInventoryPage("owner-1", null)).rejects.toThrow(/metadata/i);
  });

  it("rejects duplicate physical pathnames and malformed caller cursors", async () => {
    blobMocks.list.mockResolvedValueOnce(page([validBlob(), validBlob()]));
    await expect(listManagedAssetInventoryPage("owner-1", null)).rejects.toThrow(/metadata/i);
    await expect(listManagedAssetInventoryPage("owner-1", "bad\ncursor")).rejects.toThrow(/invalid/i);
    expect(blobMocks.list).toHaveBeenCalledTimes(1);
  });

  it("rejects a provider failure and permits a later request", async () => {
    blobMocks.list.mockRejectedValueOnce(new Error("private provider details"));
    await expect(listManagedAssetInventoryPage("owner-1", null)).rejects.toThrow("private provider details");
    blobMocks.list.mockResolvedValueOnce(page([]));
    await expect(listManagedAssetInventoryPage("owner-1", null)).resolves.toMatchObject({ items: [] });
  });

  it("aborts a provider request at the page timeout", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    blobMocks.list.mockImplementation((options: { abortSignal?: AbortSignal }) => {
      signal = options.abortSignal;
      return new Promise(() => {});
    });

    const request = listManagedAssetInventoryPage("owner-1", null);
    const settled = request.then(() => null, (error: unknown) => error);
    await vi.advanceTimersByTimeAsync(MANAGED_ASSET_INVENTORY_TIMEOUT_MS);
    const error = await settled;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/timed out/i);
    expect(signal?.aborted).toBe(true);
  });
});

describe("managed asset inventory cursor validation", () => {
  it("accepts an absent or bounded opaque cursor and rejects malformed boundaries", () => {
    expect(isValidManagedAssetInventoryCursor(null)).toBe(true);
    expect(isValidManagedAssetInventoryCursor("cursor" )).toBe(true);
    expect(isValidManagedAssetInventoryCursor("")).toBe(false);
    expect(isValidManagedAssetInventoryCursor("x".repeat(4097))).toBe(false);
    expect(isValidManagedAssetInventoryCursor("cursor\u007f")).toBe(false);
  });
});
