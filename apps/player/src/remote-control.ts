import { onValue, ref, type DataSnapshot, type Database } from "firebase/database";

import type { PlayerController } from "./player";

export type RemoteAction = "next" | "previous";

export interface RemoteCommandValue {
  action?: unknown;
  revision?: unknown;
}

export interface RemoteControlState {
  lastRevision: number | null;
}

export function createRemoteControlState(): RemoteControlState {
  return { lastRevision: null };
}

/**
 * Decide whether an incoming snapshot should trigger navigation, and if so,
 * which action. The first snapshot (baseline) never navigates; afterwards only
 * a valid action with a different/greater than the last-applied revision runs.
 */
export function resolveRemoteCommand(
  value: unknown,
  state: RemoteControlState,
): { shouldNavigate: boolean; lastRevision: number | null; action?: RemoteAction } {
  // Subscribe snapshot absent/null => treat as empty; nothing to do.
  if (typeof value !== "object" || value === null) {
    return { shouldNavigate: false, lastRevision: state.lastRevision };
  }

  const record = value as RemoteCommandValue;

  if (record.action !== "next" && record.action !== "previous") {
    return { shouldNavigate: false, lastRevision: state.lastRevision };
  }

  if (typeof record.revision !== "number" || !Number.isFinite(record.revision)) {
    return { shouldNavigate: false, lastRevision: state.lastRevision };
  }

  // Establish baseline on the very first valid snapshot; never navigate.
  if (state.lastRevision === null) {
    return { shouldNavigate: false, lastRevision: record.revision };
  }

  if (record.revision !== state.lastRevision) {
    return {
      shouldNavigate: true,
      lastRevision: record.revision,
      action: record.action,
    };
  }

  // Repeated/replayed snapshot with the same revision: do not navigate again.
  return { shouldNavigate: false, lastRevision: state.lastRevision };
}

/**
 * Subscribe to controlSpikes/{publicationId} and drive the SAME PlayerController
 * navigation used by local controls. The first snapshot establishes the
 * baseline only. Errors are logged and never take down the projection.
 */
export function subscribeRemoteControl(
  database: Database,
  publicationId: string,
  controller: PlayerController,
): () => void {
  const state = createRemoteControlState();

  const unsubscribe = onValue(
    ref(database, `controlSpikes/${publicationId}`),
    (snapshot: DataSnapshot) => {
      const decision = resolveRemoteCommand(snapshot.val(), state);
      state.lastRevision = decision.lastRevision;

      if (!decision.shouldNavigate || decision.action === undefined) {
        return;
      }

      if (decision.action === "next") {
        controller.next();
      } else {
        controller.previous();
      }
    },
    (error: Error) => {
      // Diagnóstico em desenvolvimento; o Player continua projetando.
      console.error("Player: remote control subscription error", error);
    },
  );

  return () => unsubscribe();
}
