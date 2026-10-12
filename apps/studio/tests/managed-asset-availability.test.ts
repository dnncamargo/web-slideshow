import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ head: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => ({
  BlobNotFoundError: class BlobNotFoundError extends Error {},
  head: mocks.head,
  del: mocks.del,
}));

import { BlobNotFoundError } from "@vercel/blob";
import { checkManagedAssetAvailability } from "../src/features/persistence/managed-asset-availability";

const uid = "owner-1";
const pathname = `users/${uid}/assets/123e4567-e89b-42d3-a456-426614174000.png`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_STORE_ID", "verified-test-store");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
  mocks.head.mockResolvedValue({ pathname });
});

describe("checkManagedAssetAvailability", () => {
  it("confirms the exact owner path in the configured store without writes", async () => {
    await expect(checkManagedAssetAvailability(uid, pathname)).resolves.toEqual({
      state: "available",
      storeId: "verified-test-store",
    });
    expect(mocks.head).toHaveBeenCalledWith(pathname, { storeId: "verified-test-store" });
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("reports missing only for the provider's authoritative not-found result", async () => {
    mocks.head.mockRejectedValueOnce(new BlobNotFoundError());
    await expect(checkManagedAssetAvailability(uid, pathname)).resolves.toEqual({
      state: "missing",
      storeId: "verified-test-store",
    });
  });

  it.each([
    ["provider timeout", new Error("timeout")],
    ["provider credentials", new Error("unauthorized")],
  ])("returns unknown for %s", async (_label, error) => {
    mocks.head.mockRejectedValueOnce(error);
    await expect(checkManagedAssetAvailability(uid, pathname)).resolves.toMatchObject({ state: "unknown" });
  });

  it("returns unknown when provider identity does not match the requested path", async () => {
    mocks.head.mockResolvedValueOnce({ pathname: `users/${uid}/assets/other.png` });
    await expect(checkManagedAssetAvailability(uid, pathname)).resolves.toMatchObject({ state: "unknown" });
  });

  it("returns unknown when the configured store or provider credential is unavailable", async () => {
    vi.stubEnv("BLOB_STORE_ID", "");
    await expect(checkManagedAssetAvailability(uid, pathname)).resolves.toEqual({ state: "unknown" });
    vi.stubEnv("BLOB_STORE_ID", "verified-test-store");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    await expect(checkManagedAssetAvailability(uid, pathname)).resolves.toEqual({ state: "unknown" });
    expect(mocks.head).not.toHaveBeenCalled();
  });

  it("rejects invalid and cross-owner paths before a provider request", async () => {
    await expect(checkManagedAssetAvailability(uid, "users/other/assets/file.png")).rejects.toMatchObject({ code: "invalid_identity" });
    await expect(checkManagedAssetAvailability(uid, `users/${uid}/assets/../other.png`)).rejects.toMatchObject({ code: "invalid_identity" });
    expect(mocks.head).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
