import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), head: vi.fn() }));
vi.mock("@vercel/blob", () => ({ BlobNotFoundError: class BlobNotFoundError extends Error {}, head: mocks.head }));
vi.mock("../src/features/auth/firebase-admin-auth", () => ({ verifyFirebaseIdToken: mocks.verify }));

import { GET } from "../src/app/api/managed-assets/metadata/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_STORE_ID", "mock-store");
  mocks.verify.mockResolvedValue({ uid: "owner-1" });
  mocks.head.mockResolvedValue({ pathname: "users/owner-1/assets/legacy", contentType: "text/plain", size: 12 });
});

describe("managed asset selected metadata route", () => {
  it("heads only the authenticated owner's requested object", async () => {
    const response = await GET(new Request("https://studio.example/api/managed-assets/metadata?pathname=users%2Fowner-1%2Fassets%2Flegacy", { headers: { Authorization: "Bearer id-token" } }));
    expect(response.status).toBe(200);
    expect(mocks.head).toHaveBeenCalledWith("users/owner-1/assets/legacy", { storeId: "mock-store" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ contentType: "text/plain", size: 12 });
  });
  it("rejects cross-owner paths before calling Blob and bounds pathname input", async () => {
    const response = await GET(new Request("https://studio.example/api/managed-assets/metadata?pathname=users%2Fowner-2%2Fassets%2Flegacy", { headers: { Authorization: "Bearer id-token" } }));
    expect(response.status).toBe(403);
    expect(mocks.head).not.toHaveBeenCalled();
    const invalid = await GET(new Request(`https://studio.example/api/managed-assets/metadata?pathname=${"x".repeat(2050)}`, { headers: { Authorization: "Bearer id-token" } }));
    expect(invalid.status).toBe(400);
  });
});
