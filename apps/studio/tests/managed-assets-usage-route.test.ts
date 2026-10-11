import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ verifyFirebaseIdToken: vi.fn() }));
const usageMocks = vi.hoisted(() => ({ getOwnerBlobUsage: vi.fn() }));

vi.mock("../src/features/auth/firebase-admin-auth", () => ({
  verifyFirebaseIdToken: authMocks.verifyFirebaseIdToken,
}));
vi.mock("../src/features/persistence/managed-asset-usage", () => ({
  getOwnerBlobUsage: usageMocks.getOwnerBlobUsage,
}));

import { GET } from "../src/app/api/managed-assets/usage/route";
import { FirebaseAuthenticationError } from "../src/features/persistence/persistence-errors";

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.verifyFirebaseIdToken.mockResolvedValue({ uid: "owner-1" });
  usageMocks.getOwnerBlobUsage.mockResolvedValue({
    scope: "owner",
    objectCount: 2,
    bytesUsed: 42,
    measuredAt: "2026-01-01T00:00:00.000Z",
    quotaStatus: "unknown",
  });
});

describe("managed asset usage route", () => {
  it("requires a bearer token and never returns an owner identifier", async () => {
    const response = await GET(new Request("http://localhost/api/managed-assets/usage"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "authentication" });
    expect(authMocks.verifyFirebaseIdToken).not.toHaveBeenCalled();
  });

  it("derives scope from the verified token and disables shared caching", async () => {
    const response = await GET(new Request("http://localhost/api/managed-assets/usage", {
      headers: { Authorization: "Bearer opaque-token" },
    }));
    expect(response.status).toBe(200);
    expect(authMocks.verifyFirebaseIdToken).toHaveBeenCalledWith("opaque-token");
    expect(usageMocks.getOwnerBlobUsage).toHaveBeenCalledWith("owner-1");
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ scope: "owner", objectCount: 2 }));
    expect(JSON.stringify(body)).not.toContain("owner-1");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
  });

  it("does not expose authentication or provider details", async () => {
    authMocks.verifyFirebaseIdToken.mockRejectedValueOnce(new FirebaseAuthenticationError("raw secret"));
    const authFailure = await GET(new Request("http://localhost/api/managed-assets/usage", {
      headers: { Authorization: "Bearer opaque-token" },
    }));
    expect(authFailure.status).toBe(401);
    expect(await authFailure.json()).toEqual({ error: "authentication" });

    usageMocks.getOwnerBlobUsage.mockRejectedValueOnce(new Error("provider path and token"));
    const providerFailure = await GET(new Request("http://localhost/api/managed-assets/usage", {
      headers: { Authorization: "Bearer opaque-token" },
    }));
    expect(providerFailure.status).toBe(503);
    expect(await providerFailure.json()).toEqual({ error: "unavailable" });
  });
});
