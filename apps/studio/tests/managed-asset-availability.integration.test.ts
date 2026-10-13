import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), head: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => ({
  BlobNotFoundError: class BlobNotFoundError extends Error {},
  head: mocks.head,
  del: mocks.del,
}));
vi.mock("../src/features/auth/firebase-admin-auth", () => ({ verifyFirebaseIdToken: mocks.verify }));

import { POST } from "../src/app/api/managed-assets/availability/route";
import { BlobNotFoundError } from "@vercel/blob";

const pathname = "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png";
const headers = { Authorization: "Bearer owner-token", "Content-Type": "application/json" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_STORE_ID", "selected-test-store");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_selected-test-store_test-token");
  mocks.verify.mockResolvedValue({ uid: "owner-1" });
  mocks.head.mockResolvedValue({ pathname });
});

describe("managed asset availability route integration", () => {
  it("authenticates the owner, checks one exact path in the configured store, and performs no writes", async () => {
    const response = await POST(new Request("https://studio.example/api/managed-assets/availability", {
      method: "POST", headers, body: JSON.stringify({ pathname, expectedStoreId: "selected-test-store" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ state: "available", storeId: "selected-test-store" });
    expect(mocks.head).toHaveBeenCalledWith(pathname, { storeId: "selected-test-store" });
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("reports missing only for a provider not-found response and unknown for provider failures", async () => {
    mocks.head.mockRejectedValueOnce(new BlobNotFoundError());
    const missing = await POST(new Request("https://studio.example/api/managed-assets/availability", {
      method: "POST", headers, body: JSON.stringify({ pathname, expectedStoreId: "selected-test-store" }),
    }));
    expect(await missing.json()).toEqual({ state: "missing", storeId: "selected-test-store" });

    mocks.head.mockRejectedValueOnce(new Error("timeout"));
    const unknown = await POST(new Request("https://studio.example/api/managed-assets/availability", {
      method: "POST", headers, body: JSON.stringify({ pathname, expectedStoreId: "selected-test-store" }),
    }));
    expect(await unknown.json()).toEqual({ state: "unknown", storeId: "selected-test-store" });
  });

  it("rejects unauthenticated and cross-owner checks before querying Blob", async () => {
    const unauthenticated = await POST(new Request("https://studio.example/api/managed-assets/availability", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pathname }),
    }));
    expect(unauthenticated.status).toBe(401);

    const foreign = await POST(new Request("https://studio.example/api/managed-assets/availability", {
      method: "POST", headers, body: JSON.stringify({ pathname: "users/other/assets/file.png", expectedStoreId: "selected-test-store" }),
    }));
    expect(foreign.status).toBe(403);
    expect(mocks.head).not.toHaveBeenCalled();
  });

  it("returns unknown without a read when the source hostname identifies another Store", async () => {
    const response = await POST(new Request("https://studio.example/api/managed-assets/availability", {
      method: "POST", headers, body: JSON.stringify({ pathname, expectedStoreId: "store-a" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "unknown" });
    expect(mocks.head).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
