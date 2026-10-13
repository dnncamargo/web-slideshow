import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), page: vi.fn(), validCursor: vi.fn((cursor: string | null) => cursor === null || cursor === "next") }));
vi.mock("../src/features/auth/firebase-admin-auth", () => ({ verifyFirebaseIdToken: mocks.verify }));
vi.mock("../src/features/persistence/managed-asset-inventory", () => ({ isValidManagedAssetInventoryCursor: mocks.validCursor }));
vi.mock("../src/features/persistence/managed-asset-library-files", () => ({ listManagedAssetLibraryFilePage: mocks.page }));

import { GET } from "../src/app/api/managed-assets/library-files/route";
import { FirebaseAuthenticationError } from "../src/features/persistence/persistence-errors";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ uid: "owner-1" });
  mocks.page.mockResolvedValue({ scope: "owner", records: [], hasMore: false });
});

describe("managed asset library files route", () => {
  it("uses the authenticated owner and requested inventory cursor", async () => {
    const response = await GET(new Request("https://studio.example/api/managed-assets/library-files?uid=other&cursor=next", {
      headers: { Authorization: "Bearer id-token" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith("id-token");
    expect(mocks.page).toHaveBeenCalledWith("owner-1", "next");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects unauthenticated, invalid, and duplicate cursors", async () => {
    expect((await GET(new Request("https://studio.example/api/managed-assets/library-files"))).status).toBe(401);
    mocks.validCursor.mockReturnValueOnce(false);
    expect((await GET(new Request("https://studio.example/api/managed-assets/library-files?cursor=bad", {
      headers: { Authorization: "Bearer ok" },
    }))).status).toBe(400);
    expect((await GET(new Request("https://studio.example/api/managed-assets/library-files?cursor=next&cursor=next", {
      headers: { Authorization: "Bearer ok" },
    }))).status).toBe(400);
  });

  it("returns generic service errors and preserves auth failure semantics", async () => {
    mocks.page.mockRejectedValueOnce(new Error("private provider error"));
    const unavailable = await GET(new Request("https://studio.example/api/managed-assets/library-files", {
      headers: { Authorization: "Bearer ok" },
    }));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: "unavailable" });

    mocks.verify.mockRejectedValueOnce(new FirebaseAuthenticationError("private auth detail"));
    expect((await GET(new Request("https://studio.example/api/managed-assets/library-files", {
      headers: { Authorization: "Bearer bad" },
    }))).status).toBe(401);
  });
});
