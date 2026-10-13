import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  reconcile: vi.fn(),
}));

vi.mock("../src/features/auth/firebase-admin-auth", () => ({ verifyFirebaseIdToken: mocks.verify }));
vi.mock("../src/features/persistence/managed-asset-controls", () => {
  class ManagedAssetControlError extends Error {
    constructor(readonly code: string) { super(code); }
  }
  return {
    reconcileMissingManagedAsset: mocks.reconcile,
    validateManagedAssetPath: (uid: string, path: unknown) => {
      if (typeof path !== "string" || !path.startsWith(`users/${uid}/assets/`) || path.includes("..")) {
        throw new ManagedAssetControlError("invalid_identity");
      }
      return path;
    },
    ManagedAssetControlError,
  };
});

import { FirebaseAuthenticationError } from "../src/features/persistence/persistence-errors";
import { POST } from "../src/app/api/managed-assets/reconcile/route";

const pathname = "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png";
const headers = { authorization: "Bearer owner-token", "Content-Type": "application/json" };

function request(body: unknown, requestHeaders: Record<string, string> = headers) {
  return new Request("http://localhost/api/managed-assets/reconcile", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
}

describe("managed asset reconciliation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockResolvedValue({ uid: "owner-1" });
    mocks.reconcile.mockResolvedValue({ alreadyReconciled: false });
  });

  it("requires an authenticated owner before reconciliation", async () => {
    const response = await POST(request({ pathname, expectedStoreId: "store-1" }, { "Content-Type": "application/json" }));
    expect(response.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("validates the exact owner path and requires the checked store identity", async () => {
    const wrongOwner = await POST(request({ pathname: "users/other/assets/file.png", expectedStoreId: "store-1" }));
    expect(wrongOwner.status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();

    const noStore = await POST(request({ pathname }));
    expect(noStore.status).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("passes the authenticated owner, exact path, and displayed store identity to the service", async () => {
    const response = await POST(request({ pathname, expectedStoreId: "store-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ alreadyReconciled: false });
    expect(mocks.reconcile).toHaveBeenCalledWith("owner-1", pathname, "store-1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a conflict when a fresh server check finds the Blob present", async () => {
    const { ManagedAssetControlError } = await import("../src/features/persistence/managed-asset-controls");
    mocks.reconcile.mockRejectedValue(new ManagedAssetControlError("asset_available"));
    const response = await POST(request({ pathname, expectedStoreId: "store-1" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "asset_available" });
  });

  it("preserves authentication errors and fails closed for provider errors", async () => {
    mocks.verify.mockRejectedValueOnce(new FirebaseAuthenticationError("Unauthorized."));
    const unauthorized = await POST(request({ pathname, expectedStoreId: "store-1" }));
    expect(unauthorized.status).toBe(401);

    mocks.reconcile.mockRejectedValue(new Error("provider failure"));
    const unavailable = await POST(request({ pathname, expectedStoreId: "store-1" }));
    expect(unavailable.status).toBe(503);
  });
});
