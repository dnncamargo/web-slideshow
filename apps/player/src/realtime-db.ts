import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

/**
 * Realtime Database is optional for the Player. Publishing/Firestore loading
 * works without it; remote control is only enabled when configured.
 */
function getFirebaseApp(): FirebaseApp {
  const existing = getApps()[0];

  if (existing) {
    return existing;
  }

  const entries: Array<[string, string]> = [
    ["apiKey", import.meta.env.VITE_FIREBASE_API_KEY as string],
    ["authDomain", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string],
    ["projectId", import.meta.env.VITE_FIREBASE_PROJECT_ID as string],
    ["storageBucket", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string],
    ["messagingSenderId", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string],
    ["appId", import.meta.env.VITE_FIREBASE_APP_ID as string],
  ];
  const config: Record<string, string> = {};

  for (const [key, value] of entries) {
    if (value && value.trim() !== "") {
      config[key] = value;
    }
  }

  return initializeApp(config);
}

export function getRealtimeDatabaseUrl(): string | null {
  const url = import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined;

  return url && url.trim() !== "" ? url.trim() : null;
}

/**
 * Returns the Realtime Database instance when the Player is configured for RTDB
 * remote control, or null otherwise. Never throws for missing config.
 */
export function getRealtimeDatabaseOrNull(): Database | null {
  const url = getRealtimeDatabaseUrl();

  if (!url) {
    return null;
  }

  return getDatabase(getFirebaseApp(), url);
}
