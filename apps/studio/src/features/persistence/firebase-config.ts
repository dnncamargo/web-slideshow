import { FirebaseConfigurationError } from "../persistence/persistence-errors";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Resolve the Firebase client configuration from environment variables.
 *
 * NOTE: This code runs in a browser bundle. Next.js only inlines STATIC
 * references to `process.env.NEXT_PUBLIC_*`; dynamic property access such as
 * `process.env[name]` is left un-replaced and returns undefined at runtime.
 * Therefore we must reference every variable via a literal key.
 *
 * Missing configuration results in a deterministic configuration error rather
 * than silently initializing Firebase with undefined values.
 */
export function resolveFirebaseClientConfig(): FirebaseClientConfig {
  const config: FirebaseClientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  const missing: string[] = [];

  if (!config.apiKey.trim()) {
    missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  }

  if (!config.authDomain.trim()) {
    missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  }

  if (!config.projectId.trim()) {
    missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  }

  if (!config.storageBucket.trim()) {
    missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  }

  if (!config.messagingSenderId.trim()) {
    missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  }

  if (!config.appId.trim()) {
    missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  }

  if (missing.length > 0) {
    throw new FirebaseConfigurationError(
      `Firebase is not configured. Missing environment variables: ${missing.join(", ")}.`,
    );
  }

  return config;
}