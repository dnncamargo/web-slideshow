import { onValue, ref } from "firebase/database";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { buildSlideAckPath, type SlideAck } from "./control-commands";

function isNonNegativeInteger(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function parseSlideAck(value: unknown): SlideAck | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 4) return null;
  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (
    typeof record.currentVersionId !== "string" ||
    record.currentVersionId.trim() === ""
  ) {
    return null;
  }
  if (!isNonNegativeInteger(record.revision)) return null;
  if (!isNonNegativeInteger(record.slideIndex)) return null;
  return {
    activationRevision: record.activationRevision as number,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision as number,
    slideIndex: record.slideIndex as number,
  };
}

/**
 * Subscribe to `live/slideAck`. Malformed values are ignored. Returns null when
 * Realtime Database is not configured.
 */
export function subscribeSlideAck(onAck: (ack: SlideAck) => void): (() => void) | null {
  const db = getRealtimeDatabaseOrNull();
  if (!db) return null;

  const unsubscribe = onValue(ref(db, buildSlideAckPath()), (snapshot) => {
    const ack = parseSlideAck(snapshot.val());
    if (ack) onAck(ack);
  });

  return unsubscribe;
}
