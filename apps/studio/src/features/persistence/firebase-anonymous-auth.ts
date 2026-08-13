import { signInAnonymously, type User } from "firebase/auth";

import { getFirebaseAuth } from "./firebase-client";
import { FirebaseAuthenticationError } from "./persistence-errors";

/**
 * Ensure an authenticated Firebase user, creating an anonymous session if none
 * exists. This is the temporary technical identity for Round 1.
 */
export async function ensureFirebaseUser(): Promise<User> {
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (currentUser) {
    return currentUser;
  }

  try {
    const credentials = await signInAnonymously(auth);
    const user = credentials.user;

    if (!user) {
      throw new FirebaseAuthenticationError(
        "Firebase anonymous sign-in did not return a user.",
      );
    }

    return user;
  } catch (error) {
    throw new FirebaseAuthenticationError(
      "Failed to authenticate with Firebase anonymously.",
      error,
    );
  }
}

export function getFirebaseUserId(user: User): string {
  return user.uid;
}
