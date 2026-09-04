import type { LiveCurrent } from "../live/live-current-read";
import type { LiveControlView } from "./live-control";

export const PLAYER_PRESENCE_PATH = "live/playerPresence";
export type PlayerBootStage = "starting" | "ready" | "load-failed";
export type PlayerBootErrorCode = "presentation-not-found" | "presentation-load-failed" | "player-mount-failed";

export interface PlayerPresenceReport {
  activationRevision: number;
  currentVersionId: string;
  bootId: string;
  stage: PlayerBootStage;
  transitionedAt: number;
  errorCode?: PlayerBootErrorCode;
}

export interface PlayerPresenceLease {
  activationRevision: number;
  currentVersionId: string;
  bootId: string;
  connected: boolean;
  transitionedAt: number;
}

export interface PlayerPresence {
  current: PlayerPresenceReport;
  lease: PlayerPresenceLease | null;
}

export type PlayerOperationalStatus =
  | { kind: "no-report" }
  | { kind: "starting"; presence: PlayerPresenceReport }
  | { kind: "ready"; presence: PlayerPresenceReport }
  | { kind: "load-failed"; presence: PlayerPresenceReport }
  | { kind: "disconnected"; presence: PlayerPresenceReport };

const stages = new Set<PlayerBootStage>(["starting", "ready", "load-failed"]);
const errors = new Set<PlayerBootErrorCode>(["presentation-not-found", "presentation-load-failed", "player-mount-failed"]);
const integer = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

function parseCurrent(value: unknown): PlayerPresenceReport | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (!keys.every((key) => ["activationRevision", "currentVersionId", "bootId", "stage", "transitionedAt", "errorCode"].includes(key))) return null;
  if (!integer(record.activationRevision) || !text(record.currentVersionId) || !text(record.bootId) || typeof record.stage !== "string" || !stages.has(record.stage as PlayerBootStage) || !integer(record.transitionedAt)) return null;
  if (record.stage === "load-failed") {
    if (typeof record.errorCode !== "string" || !errors.has(record.errorCode as PlayerBootErrorCode)) return null;
  } else if (record.errorCode !== undefined) return null;
  return { activationRevision: record.activationRevision, currentVersionId: record.currentVersionId.trim(), bootId: record.bootId.trim(), stage: record.stage as PlayerBootStage, transitionedAt: record.transitionedAt, ...(record.errorCode === undefined ? {} : { errorCode: record.errorCode as PlayerBootErrorCode }) };
}

function parseLease(value: unknown, bootId: string): PlayerPresenceLease | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (!keys.every((key) => ["activationRevision", "currentVersionId", "bootId", "connected", "transitionedAt"].includes(key))) return null;
  if (!integer(record.activationRevision) || !text(record.currentVersionId) || record.bootId !== bootId || typeof record.connected !== "boolean" || !integer(record.transitionedAt)) return null;
  return { activationRevision: record.activationRevision, currentVersionId: record.currentVersionId.trim(), bootId, connected: record.connected, transitionedAt: record.transitionedAt };
}

/** Finds every strictly valid connected lease aligned with the active Live identity. */
export function resolveConnectedPlayerLeases(value: unknown, live: LiveCurrent): PlayerPresenceLease[] {
  if (typeof value !== "object" || value === null) return [];
  const root = value as Record<string, unknown>;
  if (typeof root.leases !== "object" || root.leases === null) return [];
  return Object.keys(root.leases as Record<string, unknown>).sort().flatMap((bootId) => {
    const lease = parseLease((root.leases as Record<string, unknown>)[bootId], bootId);
    return lease !== null && lease.connected && lease.activationRevision === live.revision && lease.currentVersionId === live.currentVersionId ? [lease] : [];
  });
}

/** Parses current and only its exact boot-scoped lease; unrelated leases are ignored. */
export function parsePlayerPresence(value: unknown): PlayerPresence | null {
  if (typeof value !== "object" || value === null) return null;
  const root = value as Record<string, unknown>;
  if (!Object.keys(root).every((key) => key === "current" || key === "leases")) return null;
  const current = parseCurrent(root.current);
  if (current === null) return null;
  const leases = typeof root.leases === "object" && root.leases !== null
    ? root.leases as Record<string, unknown>
    : null;
  return {
    current,
    lease: parseLease(leases?.[current.bootId], current.bootId),
  };
}

export function resolvePlayerOperationalStatus(live: LiveCurrent, presence: PlayerPresence | null): PlayerOperationalStatus {
  if (presence === null || presence.current.activationRevision !== live.revision || presence.current.currentVersionId !== live.currentVersionId) return { kind: "no-report" };
  const { current, lease } = presence;
  if (lease === null || lease.activationRevision !== live.revision || lease.currentVersionId !== live.currentVersionId || !lease.connected) return { kind: "disconnected", presence: current };
  if (current.stage === "load-failed") return { kind: "load-failed", presence: current };
  if (current.stage === "ready") return { kind: "ready", presence: current };
  return { kind: "starting", presence: current };
}

export function resolveSlideEvidence(view: LiveControlView | null): "Slide state synced" | "Slide state pending" {
  return view?.status.kind === "synced" ? "Slide state synced" : "Slide state pending";
}
