import { get, onValue, ref, type DataSnapshot } from "firebase/database";

import { getRealtimeDatabaseOrNull } from "../control/realtime-db";

export const LIVE_CURRENT_PATH = "live/current";

export interface LiveCurrent {
  publicationId: string;
  currentVersionId: string;
  revision: number;
}

export type LiveState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "active"; live: LiveCurrent }
  | { kind: "error" };

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function parseLiveCurrentValue(value: unknown): LiveCurrent | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.publicationId !== "string" ||
    !record.publicationId.trim() ||
    typeof record.currentVersionId !== "string" ||
    !record.currentVersionId.trim() ||
    !isNonNegativeInteger(record.revision)
  ) {
    return null;
  }

  return {
    publicationId: record.publicationId.trim(),
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision,
  };
}

function parseLiveCurrent(snapshot: DataSnapshot): LiveCurrent | null {
  return parseLiveCurrentValue(snapshot.val());
}

export async function readLiveCurrent(): Promise<LiveCurrent | null> {
  const database = getRealtimeDatabaseOrNull();
  if (!database) return null;

  const snapshot = await get(ref(database, LIVE_CURRENT_PATH));
  return snapshot.exists() ? parseLiveCurrent(snapshot) : null;
}

export function subscribeLiveCurrent(
  onState: (state: LiveState) => void,
): (() => void) | null {
  const database = getRealtimeDatabaseOrNull();
  if (!database) return null;

  onState({ kind: "loading" });

  return onValue(
    ref(database, LIVE_CURRENT_PATH),
    (snapshot) => {
      if (!snapshot.exists()) {
        onState({ kind: "none" });
        return;
      }

      const live = parseLiveCurrent(snapshot);
      onState(live ? { kind: "active", live } : { kind: "error" });
    },
    () => onState({ kind: "error" }),
  );
}
