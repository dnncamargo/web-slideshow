import type { User } from "firebase/auth";

import { FirebaseAuthenticationError } from "./persistence-errors";

/**
 * Returns the current Firebase user only when it is a valid, non-anonymous
 * PowerShow authoring user.
 *
 * This is synchronous and NEVER:
 * - creates an anonymous account;
 * - initiates interactive login from persistence code.
 */
export function requireAuthenticatedFirebaseUser(
  getCurrentUser: () => User | null,
): User {
  const user = getCurrentUser();

  if (user === null) {
    throw new FirebaseAuthenticationError(
      "Unauthenticated: no Firebase user is signed in.",
    );
  }

  if (user.isAnonymous === true) {
    throw new FirebaseAuthenticationError(
      "Unauthenticated: anonymous users cannot access Studio authoring.",
    );
  }

  return user;
}
