import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ verifyFirebaseIdToken: vi.fn() }));
const inventoryMocks = vi.hoisted(() => ({
  isValidManagedAssetInventoryCursor: vi.fn((cursor: string | null) => cursor === null || cursor.length < 20),
  listManagedAssetInventoryPage: vi.fn(),
}));

vi.mock("../src/features/auth/firebase-admin-auth", () => ({
  verifyFirebaseIdToken: authMocks.verifyFirebaseIdToken,
}));
vi.mock("../src/features/persistence/managed-asset-inventory", () => ({
  isValidManagedAssetInventoryCursor: inventoryMocks.isValidManagedAssetInventoryCursor,
  listManagedAssetInventoryPage: inventoryMocks.listManagedAssetInventoryPage,
}));

import { GET } from "../src/app/api/managed-assets/inventory/route";
import { FirebaseAuthenticationError } from "../src/features/persistence/persistence-errors";

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.verifyFirebaseIdToken.mockResolvedValue({ uid: "owner-1" });
  inventoryMocks.listManagedAssetInventoryPage.mockResolvedValue({
    scope: "owner",
    items: [{
      pathname: "users/owner-1/assets/object-1",
      url: "https://blob.example/object-1",
      size: 42,
      uploadedAt: "2026-02-03T04:05:06.000Z",
      etag: "etag-1",
    }],
    hasMore: false,
  });
});

describe("managed asset inventory route", () => {
  it("rejects requests without a bearer token", async () => {
    const response = await GET(new Request("http://localhost/api/managed-assets/inventory"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "authentication" });
    expect(authMocks.verifyFirebaseIdToken).not.toHaveBeenCalled();
    expect(inventoryMocks.listManagedAssetInventoryPage).not.toHaveBeenCalled();
  });

  it("derives owner and cursor from the request while returning private no-store metadata", async () => {
    const response = await GET(new Request("http://localhost/api/managed-assets/inventory?cursor=opaque", {
      headers: { Authorization: "Bearer firebase-token" },
    }));
    expect(response.status).toBe(200);
    expect(authMocks.verifyFirebaseIdToken).toHaveBeenCalledWith("firebase-token");
    expect(inventoryMocks.listManagedAssetInventoryPage).toHaveBeenCalledWith("owner-1", "opaque");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(await response.json()).toMatchObject({
      scope: "owner",
      items: [{ pathname: "users/owner-1/assets/object-1", size: 42 }],
    });
  });

  it("does not accept a caller-supplied owner or expose provider errors", async () => {
    const response = await GET(new Request("http://localhost/api/managed-assets/inventory?uid=owner-2", {
      headers: { Authorization: "Bearer firebase-token" },
    }));
    expect(response.status).toBe(200);
    expect(inventoryMocks.listManagedAssetInventoryPage).toHaveBeenCalledWith("owner-1", null);

    inventoryMocks.listManagedAssetInventoryPage.mockRejectedValueOnce(new Error("token and pathname"));
    const failed = await GET(new Request("http://localhost/api/managed-assets/inventory", {
      headers: { Authorization: "Bearer firebase-token" },
    }));
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "unavailable" });
  });

  it("rejects an invalid token and malformed pagination", async () => {
    authMocks.verifyFirebaseIdToken.mockRejectedValueOnce(new FirebaseAuthenticationError("private auth details"));
    const failedAuth = await GET(new Request("http://localhost/api/managed-assets/inventory", {
      headers: { Authorization: "Bearer bad-token" },
    }));
    expect(failedAuth.status).toBe(401);

    inventoryMocks.isValidManagedAssetInventoryCursor.mockReturnValueOnce(false);
    const invalidCursor = await GET(new Request("http://localhost/api/managed-assets/inventory?cursor=invalid", {
      headers: { Authorization: "Bearer firebase-token" },
    }));
    expect(invalidCursor.status).toBe(400);
    expect(await invalidCursor.json()).toEqual({ error: "invalid_request" });
    expect(inventoryMocks.listManagedAssetInventoryPage).not.toHaveBeenCalled();
  });

  it("rejects duplicate cursors", async () => {
    const response = await GET(new Request("http://localhost/api/managed-assets/inventory?cursor=a&cursor=b", {
      headers: { Authorization: "Bearer firebase-token" },
    }));
    expect(response.status).toBe(400);
    expect(inventoryMocks.listManagedAssetInventoryPage).not.toHaveBeenCalled();
  });
});
