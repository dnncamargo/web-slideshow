"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { resolveFirebaseClientConfig } from "./firebase-config";

/**
 * Firebase client initialization.
 *
 * The module is marked "use client" because it is only intended to run in the
 * browser (Firebase Web SDK). It is guarded against Next.js development/HMR so
 * we never initialize more than one Firebase app.
 */
function initializeFirebaseApp(): FirebaseApp {
  const existing = getApps()[0];

  if (existing) {
    return existing;
  }

  const config = resolveFirebaseClientConfig();

  return initializeApp(config);
}

export function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeFirebaseApp();
}

let cachedAuth: Auth | null = null;
let cachedFirestore: Firestore | null = null;

export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp());
  }

  return cachedAuth;
}

export function getFirebaseFirestore(): Firestore {
  if (!cachedFirestore) {
    cachedFirestore = getFirestore(getFirebaseApp());
  }

  return cachedFirestore;
}
