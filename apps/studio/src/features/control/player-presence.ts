import type { LiveCurrent } from "../live/live-current-read";
import type { LiveControlView } from "./live-control";

export const PLAYER_PRESENCE_PATH = "live/playerPresence";
export type PlayerBootStage = "starting" | "ready" | "load-failed";
export type PlayerBootErrorCode = "presentation-not-found" | "presentation-load-failed" | "player-mount-failed";

export interface PlayerPresence {
  activationRevision: number;
  currentVersionId: string;
  bootId: string;
  connected: boolean;
  stage: PlayerBootStage;
  transitionedAt: number;
  errorCode?: PlayerBootErrorCode;
}

export type PlayerOperationalStatus =
  | { kind: "no-report" }
  | { kind: "starting"; presence: PlayerPresence }
  | { kind: "ready"; presence: PlayerPresence }
  | { kind: "load-failed"; presence: PlayerPresence }
  | { kind: "disconnected"; presence: PlayerPresence };

const stages = new Set<PlayerBootStage>(["starting", "ready", "load-failed"]);
const errors = new Set<PlayerBootErrorCode>(["presentation-not-found", "presentation-load-failed", "player-mount-failed"]);
const integer = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** Strict runtime parser for the intentionally small persisted presence record. */
export function parsePlayerPresence(value: unknown): PlayerPresence | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (!keys.every((key) => ["activationRevision", "currentVersionId", "bootId", "connected", "stage", "transitionedAt", "errorCode"].includes(key))) return null;
  if (!integer(record.activationRevision) || !text(record.currentVersionId) || !text(record.bootId) || typeof record.connected !== "boolean" || typeof record.stage !== "string" || !stages.has(record.stage as PlayerBootStage) || !integer(record.transitionedAt)) return null;
  if (record.stage === "load-failed") {
    if (typeof record.errorCode !== "string" || !errors.has(record.errorCode as PlayerBootErrorCode)) return null;
  } else if (record.errorCode !== undefined) return null;
  return { activationRevision: record.activationRevision, currentVersionId: record.currentVersionId.trim(), bootId: record.bootId.trim(), connected: record.connected, stage: record.stage as PlayerBootStage, transitionedAt: record.transitionedAt, ...(record.errorCode === undefined ? {} : { errorCode: record.errorCode as PlayerBootErrorCode }) };
}

export function resolvePlayerOperationalStatus(live: LiveCurrent, presence: PlayerPresence | null): PlayerOperationalStatus {
  if (presence === null || presence.activationRevision !== live.revision || presence.currentVersionId !== live.currentVersionId) return { kind: "no-report" };
  if (!presence.connected) return { kind: "disconnected", presence };
  if (presence.stage === "load-failed") return { kind: "load-failed", presence };
  if (presence.stage === "ready") return { kind: "ready", presence };
  return { kind: "starting", presence };
}

export function resolveSlideEvidence(view: LiveControlView | null): "Slide state synced" | "Slide state pending" {
  return view?.status.kind === "synced" ? "Slide state synced" : "Slide state pending";
}
