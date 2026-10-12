import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  validCursor: vi.fn((cursor: string | null) => cursor === null || cursor === "next"),
  list: vi.fn(),
}));
vi.mock("../src/features/auth/firebase-admin-auth", () => ({ verifyFirebaseIdToken: mocks.verify }));
vi.mock("../src/features/persistence/managed-asset-inventory", () => ({
  ManagedAssetInventoryAnnotationError: class ManagedAssetInventoryAnnotationError extends Error {},
  isValidManagedAssetInventoryCursor: mocks.validCursor,
  listManagedAssetInventoryPage: mocks.list,
}));

import { GET } from "../src/app/api/managed-assets/inventory/route";
import { FirebaseAuthenticationError } from "../src/features/persistence/persistence-errors";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ uid: "owner-1" });
  mocks.list.mockResolvedValue({ scope: "owner", items: [], hasMore: false });
});

describe("managed asset inventory route", () => {
  it("authenticates and derives the owner from Firebase", async () => {
    const response = await GET(new Request("https://studio.example/api/managed-assets/inventory?uid=other&cursor=next", {
      headers: { Authorization: "Bearer id-token" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith("id-token");
    expect(mocks.list).toHaveBeenCalledWith("owner-1", "next");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects missing authentication, invalid cursors, and duplicate cursors", async () => {
    expect((await GET(new Request("https://studio.example/api/managed-assets/inventory"))).status).toBe(401);
    mocks.validCursor.mockReturnValueOnce(false);
    expect((await GET(new Request("https://studio.example/api/managed-assets/inventory?cursor=bad", { headers: { Authorization: "Bearer ok" } }))).status).toBe(400);
    expect((await GET(new Request("https://studio.example/api/managed-assets/inventory?cursor=next&cursor=next", { headers: { Authorization: "Bearer ok" } }))).status).toBe(400);
  });
  it("returns generic unavailable errors for listing failures", async () => {
    mocks.list.mockRejectedValueOnce(new Error("private token data"));
    const response = await GET(new Request("https://studio.example/api/managed-assets/inventory", { headers: { Authorization: "Bearer ok" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    mocks.verify.mockRejectedValueOnce(new FirebaseAuthenticationError("private auth detail"));
    expect((await GET(new Request("https://studio.example/api/managed-assets/inventory", { headers: { Authorization: "Bearer bad" } }))).status).toBe(401);
  });

  it("returns a recognizable response when persisted annotations are unavailable", async () => {
    const { ManagedAssetInventoryAnnotationError } = await import("../src/features/persistence/managed-asset-inventory");
    mocks.list.mockRejectedValueOnce(new ManagedAssetInventoryAnnotationError());
    const response = await GET(new Request("https://studio.example/api/managed-assets/inventory", { headers: { Authorization: "Bearer ok" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "annotations_unavailable" });
  });
});
