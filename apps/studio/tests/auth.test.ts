import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  signInAnonymously: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: authMocks.onAuthStateChanged,
  signInWithPopup: authMocks.signInWithPopup,
  signOut: authMocks.signOut,
  signInAnonymously: authMocks.signInAnonymously,
  GoogleAuthProvider: authMocks.GoogleAuthProvider,
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
}));

import { normalizeAuthState, signInWithGoogle, signOutCurrentUser } from "../src/features/auth/firebase-auth";
import { requireAuthenticatedFirebaseUser } from "../src/features/persistence/authenticated-user";
import { FirebaseAuthenticationError } from "../src/features/persistence/persistence-errors";

function user(overrides: Partial<{ isAnonymous: boolean; uid: string }> = {}) {
  return { uid: "uid-1", isAnonymous: false, ...overrides } as never;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("auth state normalization", () => {
  it("resolves null to unauthenticated", () => {
    expect(normalizeAuthState(null)).toEqual({
      status: "unauthenticated",
      user: null,
    });
  });

  it("resolves a non-anonymous user to authenticated", () => {
    const u = user({ isAnonymous: false });

    expect(normalizeAuthState(u).status).toBe("authenticated");
    expect(normalizeAuthState(u).user).toBe(u);
  });

  it("resolves an anonymous user to unauthenticated", () => {
    expect(normalizeAuthState(user({ isAnonymous: true }))).toEqual({
      status: "unauthenticated",
      user: null,
    });
  });
});

describe("requireAuthenticatedFirebaseUser", () => {
  it("returns the non-anonymous current user", () => {
    const u = user({ isAnonymous: false });

    expect(requireAuthenticatedFirebaseUser(() => u)).toBe(u);
  });

  it("throws a FirebaseAuthenticationError when no user exists", () => {
    expect(() => requireAuthenticatedFirebaseUser(() => null)).toThrow(
      FirebaseAuthenticationError,
    );
  });

  it("throws a FirebaseAuthenticationError for an anonymous user", () => {
    expect(() =>
      requireAuthenticatedFirebaseUser(() => user({ isAnonymous: true })),
    ).toThrow(FirebaseAuthenticationError);
  });

  it("never invokes anonymous sign-in", () => {
    try {
      requireAuthenticatedFirebaseUser(() => null);
    } catch {
      // ignore
    }

    expect(authMocks.signInAnonymously).not.toHaveBeenCalled();
  });
});

describe("Google sign-in", () => {
  it("calls signInWithPopup with the existing Auth and a Google provider", async () => {
    authMocks.signInWithPopup.mockResolvedValue({ user: user() });
    authMocks.GoogleAuthProvider.mockImplementation(() => ({}));

    await signInWithGoogle({ currentUser: null } as never);

    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(authMocks.GoogleAuthProvider).toHaveBeenCalledTimes(1);
    expect(authMocks.signInWithPopup).toHaveBeenCalledWith(
      { currentUser: null },
      {},
    );
    expect(authMocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it("propagates failures", async () => {
    authMocks.signInWithPopup.mockRejectedValue(new Error("popup-closed"));

    await expect(
      signInWithGoogle({ currentUser: null } as never),
    ).rejects.toThrow("popup-closed");
  });
});

describe("sign out", () => {
  it("invokes Firebase signOut", async () => {
    authMocks.signOut.mockResolvedValue(undefined);

    await signOutCurrentUser({ currentUser: null } as never);

    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
  });
});
