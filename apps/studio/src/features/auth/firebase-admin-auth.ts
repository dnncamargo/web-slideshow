import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

import {
  FirebaseAuthenticationError,
  FirebaseConfigurationError,
} from "../persistence/persistence-errors";

export interface VerifiedFirebaseUser {
  uid: string;
}

let cachedAdminAuth: Auth | null = null;

function getFirebaseAdminAuth(): Auth {
  if (cachedAdminAuth) {
    return cachedAdminAuth;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseConfigurationError(
      "Firebase Admin authentication is not configured.",
    );
  }

  const app = getApps().length > 0
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

  cachedAdminAuth = getAuth(app);
  return cachedAdminAuth;
}

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedFirebaseUser> {
  if (!idToken.trim()) {
    throw new FirebaseAuthenticationError(
      "Unauthenticated: a Firebase ID token is required.",
    );
  }

  let decodedToken;

  try {
    decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);
  } catch (error) {
    if (
      error instanceof FirebaseConfigurationError ||
      error instanceof FirebaseAuthenticationError
    ) {
      throw error;
    }

    throw new FirebaseAuthenticationError(
      "Unauthenticated: the Firebase ID token is invalid.",
      error,
    );
  }

  if (!decodedToken.uid) {
    throw new FirebaseAuthenticationError(
      "Unauthenticated: the Firebase ID token has no user ID.",
    );
  }

  if (decodedToken.firebase?.sign_in_provider === "anonymous") {
    throw new FirebaseAuthenticationError(
      "Unauthenticated: anonymous Firebase users cannot upload managed assets.",
    );
  }

  return { uid: decodedToken.uid };
}
