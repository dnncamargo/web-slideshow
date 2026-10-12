import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@vercel/blob", () => ({ list: blob.list }));
const controls = vi.hoisted(() => ({ readNames: vi.fn() }));
vi.mock("../src/features/persistence/managed-asset-controls", () => ({ readManagedAssetDisplayNames: controls.readNames }));

import {
  isValidManagedAssetInventoryCursor,
  getManagedAssetInventoryObject,
  listManagedAssetInventoryPage,
  MANAGED_ASSET_INVENTORY_PAGE_SIZE,
} from "../src/features/persistence/managed-asset-inventory";

const item = (pathname = "users/owner-1/assets/asset-1.png") => ({
  pathname, url: "https://blob.example/asset-1", size: 128,
  uploadedAt: new Date("2026-01-02T03:04:05Z"), etag: "etag-value",
});

beforeEach(() => {
  vi.clearAllMocks();
  controls.readNames.mockResolvedValue(new Map());
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "mock-token");
  vi.stubEnv("BLOB_STORE_ID", "mock-store");
});
afterEach(() => vi.unstubAllEnvs());

describe("managed asset inventory", () => {
  it("lists a bounded physical page scoped to the authenticated owner", async () => {
    blob.list.mockResolvedValueOnce({ blobs: [item()], hasMore: false });
    await expect(listManagedAssetInventoryPage("owner-1", null)).resolves.toEqual({
      scope: "owner", hasMore: false, items: [{
        pathname: "users/owner-1/assets/asset-1.png", url: "https://blob.example/asset-1",
        size: 128, uploadedAt: "2026-01-02T03:04:05.000Z", etag: "etag-value",
      }],
    });
    expect(blob.list).toHaveBeenCalledWith(expect.objectContaining({
      prefix: "users/owner-1/assets/", storeId: "mock-store", mode: "expanded", limit: MANAGED_ASSET_INVENTORY_PAGE_SIZE,
    }));
  });

  it("annotates only the current Blob page in one owner-scoped lookup", async () => {
    const firstPath = "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png";
    const secondPath = "users/owner-1/assets/223e4567-e89b-42d3-a456-426614174000.png";
    blob.list.mockResolvedValueOnce({ blobs: [item(firstPath), item(secondPath)], hasMore: true, cursor: "next" });
    controls.readNames.mockResolvedValueOnce(new Map([[secondPath, "Renamed 📘"]]));
    const page = await listManagedAssetInventoryPage("owner-1", null);
    expect(page.items.map((entry) => entry.displayName)).toEqual([undefined, "Renamed 📘"]);
    expect(controls.readNames).toHaveBeenCalledWith("owner-1", [firstPath, secondPath]);
  });

  it("passes opaque pagination cursors and validates returned boundaries", async () => {
    blob.list.mockResolvedValueOnce({ blobs: [item()], hasMore: true, cursor: "opaque-next" });
    await expect(listManagedAssetInventoryPage("owner-1", "opaque-current")).resolves.toMatchObject({ cursor: "opaque-next", hasMore: true });
    expect(blob.list).toHaveBeenCalledWith(expect.objectContaining({ cursor: "opaque-current" }));
    blob.list.mockResolvedValueOnce({ blobs: [], hasMore: true, cursor: "opaque-current" });
    await expect(listManagedAssetInventoryPage("owner-1", "opaque-current")).rejects.toThrow(/cursor/i);
    expect(isValidManagedAssetInventoryCursor("cursor")).toBe(true);
    expect(isValidManagedAssetInventoryCursor("bad\nvalue")).toBe(false);
  });

  it("resolves one exact object independently of the current inventory cursor", async () => {
    blob.list.mockResolvedValueOnce({ blobs: [item("users/owner-1/assets/target.woff2")], hasMore: true, cursor: "other-page" });
    await expect(getManagedAssetInventoryObject("owner-1", "users/owner-1/assets/target.woff2"))
      .resolves.toMatchObject({ pathname: "users/owner-1/assets/target.woff2", etag: "etag-value" });
    expect(blob.list).toHaveBeenCalledWith(expect.objectContaining({
      prefix: "users/owner-1/assets/target.woff2", limit: MANAGED_ASSET_INVENTORY_PAGE_SIZE,
    }));
  });

  it("loads a focused object's display name outside the inventory page", async () => {
    const path = "users/owner-1/assets/323e4567-e89b-42d3-a456-426614174000.woff2";
    blob.list.mockResolvedValueOnce({ blobs: [item(path)], hasMore: false });
    controls.readNames.mockResolvedValueOnce(new Map([[path, "Focused font"]]));
    await expect(getManagedAssetInventoryObject("owner-1", path)).resolves.toMatchObject({ displayName: "Focused font" });
    expect(controls.readNames).toHaveBeenCalledWith("owner-1", [path]);
  });

  it("fails recognizably when display-name annotations cannot be read", async () => {
    blob.list.mockResolvedValueOnce({ blobs: [item("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png")], hasMore: false });
    controls.readNames.mockRejectedValueOnce(new Error("Firestore unavailable"));
    await expect(listManagedAssetInventoryPage("owner-1", null)).rejects.toMatchObject({ name: "ManagedAssetInventoryAnnotationError" });
  });

  it.each([
    item("users/owner-2/assets/foreign.png"),
    { ...item(), size: -1 },
    { ...item(), etag: "" },
    { ...item(), url: "javascript:alert(1)" },
  ])("rejects invalid physical metadata", async (badItem) => {
    blob.list.mockResolvedValueOnce({ blobs: [badItem], hasMore: false });
    await expect(listManagedAssetInventoryPage("owner-1", null)).rejects.toThrow(/metadata/i);
  });

  it("rejects owner path injection and provider errors", async () => {
    await expect(listManagedAssetInventoryPage("owner-1/owner-2", null)).rejects.toThrow(/invalid/i);
    blob.list.mockRejectedValueOnce(new Error("provider failure"));
    await expect(listManagedAssetInventoryPage("owner-1", null)).rejects.toThrow("provider failure");
  });
});
