import type { LiveControlStatus } from "./live-control";

export const CONTROL_LATENCY_SNAPSHOT_KEY =
  "powershow:studio-control-latency:v1";

export interface ControlLatencySnapshot {
  publicationId: string;
  activationRevision: number;
  currentVersionId: string;
  latencyMs: number;
  measuredAt: number;
}

export type ControlLatencyIdentity = Pick<
  ControlLatencySnapshot,
  "publicationId" | "activationRevision" | "currentVersionId"
>;

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function exactText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value !== "" &&
    value.trim() === value
  );
}

function nonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function nonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function getSessionStorage(): SessionStorageLike | null {
  try {
    return (
      (globalThis as { sessionStorage?: SessionStorageLike }).sessionStorage ??
      null
    );
  } catch {
    return null;
  }
}

export function parseControlLatencySnapshot(
  value: unknown,
): ControlLatencySnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 5 ||
    !exactText(record.publicationId) ||
    !nonNegativeInteger(record.activationRevision) ||
    !exactText(record.currentVersionId) ||
    !nonNegativeFinite(record.latencyMs) ||
    !nonNegativeFinite(record.measuredAt)
  ) {
    return null;
  }

  return {
    publicationId: record.publicationId,
    activationRevision: record.activationRevision,
    currentVersionId: record.currentVersionId,
    latencyMs: record.latencyMs,
    measuredAt: record.measuredAt,
  };
}

export function readControlLatencySnapshot(
  identity: ControlLatencyIdentity,
): ControlLatencySnapshot | null {
  const storage = getSessionStorage();
  if (storage === null) {
    return null;
  }

  try {
    const raw = storage.getItem(CONTROL_LATENCY_SNAPSHOT_KEY);
    if (raw === null) {
      return null;
    }

    const snapshot = parseControlLatencySnapshot(JSON.parse(raw) as unknown);
    if (
      snapshot === null ||
      snapshot.publicationId !== identity.publicationId ||
      snapshot.activationRevision !== identity.activationRevision ||
      snapshot.currentVersionId !== identity.currentVersionId
    ) {
      return null;
    }

    return snapshot;
  } catch {
    return null;
  }
}

export function writeControlLatencySnapshot(
  snapshot: ControlLatencySnapshot,
): void {
  const validSnapshot = parseControlLatencySnapshot(snapshot);
  const storage = getSessionStorage();
  if (validSnapshot === null || storage === null) {
    return;
  }

  try {
    storage.setItem(
      CONTROL_LATENCY_SNAPSHOT_KEY,
      JSON.stringify(validSnapshot),
    );
  } catch {
    // Transient diagnostics must never interrupt Control.
  }
}

export function recordControlLatencyMeasurement(
  identity: ControlLatencyIdentity,
  status: LiveControlStatus,
  measuredAt = Date.now(),
): void {
  if (status.kind !== "synced" || status.latencyMs === undefined) {
    return;
  }

  writeControlLatencySnapshot({
    ...identity,
    latencyMs: status.latencyMs,
    measuredAt,
  });
}
