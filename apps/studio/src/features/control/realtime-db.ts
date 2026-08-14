import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

import { resolveFirebaseClientConfig } from "../persistence/firebase-config";

/**
 * Realtime Database is optional: it is only used by the temporary remote-control
 * spike. When NEXT_PUBLIC_FIREBASE_DATABASE_URL is absent, authoring and
 * published loading continue to work normally; control is unavailable.
 */
export function getFirebaseDatabaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  return url && url.trim() !== "" ? url.trim() : null;
}

export function isRealtimeDatabaseConfigured(): boolean {
  return getFirebaseDatabaseUrl() !== null;
}

function getOrInitApp(): FirebaseApp {
  const existing = getApps()[0];

  if (existing) {
    return existing;
  }

  return initializeApp(resolveFirebaseClientConfig());
}

/**
 * Returns a Realtime Database instance, or null when not configured.
 * Callers must handle the null case (control unavailable).
 */
export function getRealtimeDatabaseOrNull(): Database | null {
  const url = getFirebaseDatabaseUrl();

  if (!url) {
    return null;
  }

  return getDatabase(getOrInitApp(), url);
}
