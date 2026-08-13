import { FirebaseConfigurationError } from "../persistence/persistence-errors";

export const FIREBASE_ENV_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function getMissingFirebaseEnvVars(): string[] {
  return FIREBASE_ENV_VARS.filter((name) => !process.env[name]?.trim());
}

/**
 * Resolve the Firebase client configuration from environment variables.
 *
 * Missing configuration results in a deterministic configuration error rather
 * than silently initializing Firebase with undefined values.
 */
export function resolveFirebaseClientConfig(): FirebaseClientConfig {
  const missing = getMissingFirebaseEnvVars();

  if (missing.length > 0) {
    throw new FirebaseConfigurationError(
      `Firebase is not configured. Missing environment variables: ${missing.join(", ")}.`,
    );
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY as string,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string,
  };
}
