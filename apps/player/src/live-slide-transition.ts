import { onValue, ref, type Database } from "firebase/database";

import type { PlayerController, PlayerTransition } from "./player";

export const SLIDE_TRANSITION_PATH = "live/slideTransition";

export interface LiveSlideTransitionRecord {
  activationRevision: number;
  transition: PlayerTransition;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function parseLiveSlideTransition(value: unknown): LiveSlideTransitionRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !isNonNegativeInteger(record.activationRevision)) return null;
  if (record.transition !== "fade" && record.transition !== "slide" && record.transition !== "none") return null;
  return { activationRevision: record.activationRevision, transition: record.transition };
}

export function resolveLiveSlideTransition(value: unknown, activationRevision: number): PlayerTransition {
  const record = parseLiveSlideTransition(value);
  return record?.activationRevision === activationRevision ? record.transition : "fade";
}

export function subscribeLiveSlideTransition(
  database: Database,
  activationRevision: number,
  controller: Pick<PlayerController, "setTransition">,
): () => void {
  return onValue(ref(database, SLIDE_TRANSITION_PATH), (snapshot) => {
    controller.setTransition?.(resolveLiveSlideTransition(snapshot.val(), activationRevision));
  });
}
