"use client";

import { ref, set } from "firebase/database";

import {
  FirebaseAuthenticationError,
  FirestoreOperationError,
} from "../persistence/persistence-errors";

import {
  buildControlCommand,
  buildControlPath,
  type ControlAction,
} from "./control-commands";
import {
  getRealtimeDatabaseOrNull,
  isRealtimeDatabaseConfigured,
} from "./realtime-db";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";

function getCurrentUserIdForControl(): string {
  const user = getCurrentNonAnonymousUser();

  if (user === null) {
    throw new FirebaseAuthenticationError(
      "Control requires an authenticated non-anonymous user.",
    );
  }

  return user.uid;
}

/**
 * Write a remote-control command to `controlSpikes/{publicationId}`.
 *
 * Requires an authenticated non-anonymous Firebase user and configured RTDB.
 * Revision always changes on every write (the caller supplies a fresh value).
 */
export async function writeControlCommand(
  publicationId: string,
  action: ControlAction,
  revision: number,
): Promise<void> {
  if (publicationId.trim() === "") {
    throw new Error("Control requires a publicationId.");
  }

  if (!isRealtimeDatabaseConfigured()) {
    throw new Error("Realtime Database is not configured.");
  }

  getCurrentUserIdForControl();

  const database = getRealtimeDatabaseOrNull();

  if (database === null) {
    throw new Error("Realtime Database is not configured.");
  }

  try {
    await set(
      ref(database, buildControlPath(publicationId)),
      buildControlCommand(action, revision),
    );
  } catch (error) {
    console.error("Control: could not write remote command", error);

    throw new FirestoreOperationError(
      "Could not send remote command.",
      error,
    );
  }
}
