import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
  onAuthStateChanged,
  type Unsubscribe,
} from "firebase/auth";

import { getFirebaseAuth } from "../persistence/firebase-client";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface ObservableAuthState {
  status: AuthStatus;
  user: User | null;
}

/**
 * Normalize Firebase auth state into the Studio's three-state model.
 *
 * Anonymous Firebase users are NOT valid PowerShow authoring users: they
 * resolve to "unauthenticated" so an anonymous session never grants Studio
 * access.
 */
export function normalizeAuthState(user: User | null): ObservableAuthState {
  if (user !== null && user.isAnonymous === false) {
    return { status: "authenticated", user };
  }

  return { status: "unauthenticated", user: null };
}

export function subscribeToAuthState(
  onState: (state: ObservableAuthState) => void,
): Unsubscribe {
  const auth = getFirebaseAuth();

  return onAuthStateChanged(auth, (user) => {
    onState(normalizeAuthState(user));
  });
}

/**
 * Returns the current non-anonymous Firebase User, or null when no such user
 * exists. This never starts interactive login and never creates an anonymous
 * account.
 */
export function getCurrentNonAnonymousUser(): User | null {
  const current = getFirebaseAuth().currentUser;

  if (current !== null && current.isAnonymous === false) {
    return current;
  }

  return null;
}

/**
 * Sign in with Google using a popup. Never uses redirect and never requests
 * extra OAuth scopes.
 */
export async function signInWithGoogle(auth = getFirebaseAuth()): Promise<User> {
  const provider = new GoogleAuthProvider();

  const credentials = await signInWithPopup(auth, provider);

  return credentials.user;
}

export async function signOutCurrentUser(auth = getFirebaseAuth()): Promise<void> {
  await signOut(auth);
}
