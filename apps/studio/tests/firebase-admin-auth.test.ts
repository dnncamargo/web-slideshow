import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminMocks = vi.hoisted(() => ({
  cert: vi.fn(),
  getApp: vi.fn(),
  getApps: vi.fn(),
  getAuth: vi.fn(),
  initializeApp: vi.fn(),
  verifyIdToken: vi.fn(),
}));

vi.mock("firebase-admin/app", () => ({
  cert: adminMocks.cert,
  getApp: adminMocks.getApp,
  getApps: adminMocks.getApps,
  initializeApp: adminMocks.initializeApp,
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: adminMocks.getAuth,
}));

import { FirebaseAuthenticationError } from "../src/features/persistence/persistence-errors";

async function loadVerifier() {
  const authModule = await import("../src/features/auth/firebase-admin-auth");
  return authModule.verifyFirebaseIdToken;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project");
  vi.stubEnv("FIREBASE_ADMIN_CLIENT_EMAIL", "admin@example.com");
  vi.stubEnv("FIREBASE_ADMIN_PRIVATE_KEY", "private-key");
  adminMocks.getApps.mockReturnValue([]);
  adminMocks.initializeApp.mockReturnValue({ name: "[DEFAULT]" });
  adminMocks.getAuth.mockReturnValue({ verifyIdToken: adminMocks.verifyIdToken });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyFirebaseIdToken", () => {
  it("returns the UID for a valid non-anonymous Firebase token", async () => {
    adminMocks.verifyIdToken.mockResolvedValue({
      firebase: { sign_in_provider: "password" },
      uid: "owner",
    });

    const verifyFirebaseIdToken = await loadVerifier();

    await expect(verifyFirebaseIdToken("valid-token")).resolves.toEqual({
      uid: "owner",
    });
    expect(adminMocks.cert).toHaveBeenCalledWith({
      clientEmail: "admin@example.com",
      privateKey: "private-key",
      projectId: "project",
    });
  });

  it("rejects a missing token before contacting Firebase Admin", async () => {
    const verifyFirebaseIdToken = await loadVerifier();

    await expect(verifyFirebaseIdToken(" ")).rejects.toBeInstanceOf(
      FirebaseAuthenticationError,
    );
    expect(adminMocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("translates malformed Firebase Admin tokens into an authentication error", async () => {
    const cause = new Error("malformed token");
    adminMocks.verifyIdToken.mockRejectedValue(cause);
    const verifyFirebaseIdToken = await loadVerifier();

    const error = await verifyFirebaseIdToken("malformed-token").catch(
      (value: unknown) => value,
    );

    expect(error).toBeInstanceOf(FirebaseAuthenticationError);
    expect((error as FirebaseAuthenticationError).cause).toBe(cause);
  });

  it("rejects anonymous Firebase tokens", async () => {
    adminMocks.verifyIdToken.mockResolvedValue({
      firebase: { sign_in_provider: "anonymous" },
      uid: "anonymous",
    });
    const verifyFirebaseIdToken = await loadVerifier();

    await expect(verifyFirebaseIdToken("anonymous-token")).rejects.toBeInstanceOf(
      FirebaseAuthenticationError,
    );
  });
});
