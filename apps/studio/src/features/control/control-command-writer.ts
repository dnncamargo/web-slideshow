"use client";

import { ref, runTransaction, set, type Database } from "firebase/database";

import {
  FirebaseAuthenticationError,
  FirestoreOperationError,
} from "../persistence/persistence-errors";

import {
  buildControlCommand,
  buildControlPath,
  buildSlideCommandPath,
  type ControlAction,
  type SlideCommand,
} from "./control-commands";
import {
  getRealtimeDatabaseOrNull,
  isRealtimeDatabaseConfigured,
} from "./realtime-db";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";
import {
  buildControlStatePath,
  parseLiveControlState,
  type LiveControlState,
} from "../live/live-state";

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

function isNonNegativeInteger(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function parseSlideCommand(value: unknown): SlideCommand | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.currentVersionId !== "string" ||
    record.currentVersionId.trim() === ""
  ) {
    return null;
  }
  if (typeof record.pageId !== "string" || record.pageId.trim() === "") {
    return null;
  }
  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonNegativeInteger(record.revision) || (record.revision as number) < 1) {
    return null;
  }
  return {
    activationRevision: record.activationRevision as number,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision as number,
    pageId: record.pageId.trim(),
  };
}

/**
 * Write an absolute slide target to `live/slideCommand`.
 *
 * Commands are scoped to an activation. Within the same activation the command
 * revision increments; a different/absent activation restarts at 1. Returns the
 * committed command.
 */
export async function writeSlideCommand(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  pageId: string,
): Promise<SlideCommand> {
  if (!isRealtimeDatabaseConfigured()) {
    throw new Error("Realtime Database is not configured.");
  }

  getCurrentUserIdForControl();

  const trimmedCurrentVersionId = currentVersionId.trim();
  if (trimmedCurrentVersionId === "") {
    throw new Error("Slide command requires a currentVersionId.");
  }
  const trimmedPageId = pageId.trim();
  if (trimmedPageId === "") {
    throw new Error("Slide command requires a pageId.");
  }

  const commandRef = ref(database, buildSlideCommandPath());

  const result = await runTransaction(commandRef, (current) => {
    const previous = parseSlideCommand(current);
    const revision =
      previous !== null &&
      previous.activationRevision === activationRevision &&
      previous.currentVersionId === trimmedCurrentVersionId
        ? previous.revision + 1
        : 1;
    return {
      activationRevision,
      currentVersionId: trimmedCurrentVersionId,
      revision,
      pageId: trimmedPageId,
    };
  });

  if (result.committed !== true) {
    throw new Error("Slide command transaction did not commit.");
  }

  const committed = parseSlideCommand(result.snapshot.val());
  if (committed === null) {
    throw new Error("Slide command transaction committed a malformed value.");
  }

  return committed;
}

/**
 * Write the desired live control state to `live/controlState` transactionally.
 *
 * Revision starts at 1 for a fresh Live identity and increments only within
 * the same activation/current-version pair.
 */
export async function writeControlState(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  pageId: string,
): Promise<LiveControlState> {
  if (!isRealtimeDatabaseConfigured()) {
    throw new Error("Realtime Database is not configured.");
  }

  getCurrentUserIdForControl();

  const trimmedCurrentVersionId = currentVersionId.trim();
  if (trimmedCurrentVersionId === "") {
    throw new Error("Control state requires a currentVersionId.");
  }

  const trimmedPageId = pageId.trim();
  if (trimmedPageId === "") {
    throw new Error("Control state requires a pageId.");
  }

  const controlRef = ref(database, buildControlStatePath());

  const result = await runTransaction(controlRef, (current) => {
    const previous = parseLiveControlState(current);

    if (
      previous !== null &&
      (previous.activationRevision !== activationRevision ||
        previous.currentVersionId !== trimmedCurrentVersionId)
    ) {
      return;
    }

    const revision =
      previous !== null ? previous.revision + 1 : 1;

    return {
      activationRevision,
      currentVersionId: trimmedCurrentVersionId,
      revision,
      pageId: trimmedPageId,
    };
  });

  if (result.committed !== true) {
    throw new Error("Control state transaction did not commit.");
  }

  const committed = parseLiveControlState(result.snapshot.val());

  if (committed === null) {
    throw new Error("Control state transaction committed a malformed value.");
  }

  return committed;
}
