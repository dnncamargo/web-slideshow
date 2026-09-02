import { ref, runTransaction, update } from "firebase/database";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { FirebaseAuthenticationError } from "../persistence/persistence-errors";
import { getCurrentNonAnonymousUser } from "../auth/firebase-auth";

import {
  parseLiveCurrentValue,
  readLiveCurrent,
  subscribeLiveCurrent,
  type LiveCurrent,
  type LiveState,
} from "../live/live-current-read";

export {
  readLiveCurrent,
  subscribeLiveCurrent,
  type LiveCurrent,
  type LiveState,
};

function requireAuth() {
  const user = getCurrentNonAnonymousUser();
  if (!user) throw new FirebaseAuthenticationError("Authentication required.");
}

function parseActivationRevision(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

export async function activateLivePresentation(
  publicationId: string,
  currentVersionId: string,
): Promise<void> {
  requireAuth();
  const db = getRealtimeDatabaseOrNull();
  if (!db) throw new Error("Realtime Database is not configured.");

  const trimmedPublicationId = publicationId.trim();
  const trimmedCurrentVersionId = currentVersionId.trim();

  if (trimmedPublicationId === "") {
    throw new Error("Activation requires a publicationId.");
  }
  if (trimmedCurrentVersionId === "") {
    throw new Error("Activation requires a currentVersionId.");
  }

  const liveRef = ref(db, "live");

  const result = await runTransaction(liveRef, (current) => {
    const currentRecord =
      typeof current === "object" && current !== null
        ? (current as Record<string, unknown>)
        : null;

    const baseline = parseActivationRevision(currentRecord?.activationRevision);
    const newActivationRevision = baseline === null ? 1 : baseline + 1;

      return {
        activationRevision: newActivationRevision,
        current: {
          publicationId: trimmedPublicationId,
          currentVersionId: trimmedCurrentVersionId,
          revision: newActivationRevision,
        },
        controlState: null,
        playerState: null,
        playerPresence: null,
        fullscreenRequest: null,
        playerRecoveryRequest: null,
        slideCommand: null,
        slideAck: null,
        galleryControl: null,
      };
  });

  if (result.committed !== true) {
    throw new Error("Live activation transaction did not commit.");
  }
}

/**
 * Promote an active Live session to a newer immutable published version.
 * The activation revision is preserved and stale command/ACK state is cleared
 * in the same transaction. A retry after the target is already active is a
 * no-op so it cannot clear fresh state from the promoted Player.
 */
export async function promoteLivePresentationVersion(
  expectedLive: LiveCurrent,
  targetVersionId: string,
): Promise<void> {
  requireAuth();
  const db = getRealtimeDatabaseOrNull();
  if (!db) throw new Error("Realtime Database is not configured.");

  const trimmedTargetVersionId = targetVersionId.trim();
  if (trimmedTargetVersionId === "") {
    throw new Error("Live promotion requires a currentVersionId.");
  }

  if (trimmedTargetVersionId === expectedLive.currentVersionId) {
    return;
  }

  const outcome: {
    kind:
      | "pending"
      | "uncached"
      | "promoted"
      | "already-promoted"
      | "stale";
  } = { kind: "pending" };

  const result = await runTransaction(
    ref(db, "live"),
    (current) => {
      if (current === null) {
        // RTDB may call the updater with an uncached local null before retrying
        // with the server value. Returning undefined here would abort before
        // the compare-and-swap can observe that value. A null proposal cannot
        // create or promote a session; if null is also current on the server,
        // the completed no-op is classified as stale below.
        outcome.kind = "uncached";
        return null;
      }

      if (typeof current !== "object") {
        outcome.kind = "stale";
        return undefined;
      }

      const currentRecord = current as Record<string, unknown>;
      const live = parseLiveCurrentValue(currentRecord.current);

      if (
        live !== null &&
        live.publicationId === expectedLive.publicationId &&
        live.revision === expectedLive.revision &&
        live.currentVersionId === trimmedTargetVersionId
      ) {
        outcome.kind = "already-promoted";
        return undefined;
      }

      if (
        live === null ||
        live.publicationId !== expectedLive.publicationId ||
        live.currentVersionId !== expectedLive.currentVersionId ||
        live.revision !== expectedLive.revision
      ) {
        outcome.kind = "stale";
        return undefined;
      }

      outcome.kind = "promoted";
      return {
        ...currentRecord,
        current: {
          publicationId: live.publicationId,
          currentVersionId: trimmedTargetVersionId,
          revision: live.revision,
        },
        controlState: null,
        playerState: null,
        playerPresence: null,
        fullscreenRequest: null,
        playerRecoveryRequest: null,
        slideCommand: null,
        slideAck: null,
        galleryControl: null,
      };
    },
    { applyLocally: false },
  );

  if (
    outcome.kind === "already-promoted" ||
    (result.committed === true && outcome.kind === "promoted")
  ) {
    return;
  }

  if (outcome.kind === "stale" || outcome.kind === "uncached") {
    throw new Error("Live session changed before version promotion.");
  }

  throw new Error("Live version promotion transaction did not commit.");
}

export async function endLivePresentation(): Promise<void> {
  requireAuth();
  const db = getRealtimeDatabaseOrNull();
  if (!db) return;

  const liveRef = ref(db, "live");

  await update(liveRef, {
    current: null,
    controlState: null,
    playerState: null,
    playerPresence: null,
    fullscreenRequest: null,
    playerRecoveryRequest: null,
    slideCommand: null,
    slideAck: null,
    galleryControl: null,
  });
}
