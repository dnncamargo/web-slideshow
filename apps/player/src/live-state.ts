/**
 * Minimal Live projection-state protocol primitives for the Player.
 *
 * These types, parsers and path constants are the additive foundation for the
 * desired/applied projection contract. This module does not subscribe to or
 * write any Live node yet; it only exposes the shared wire contract so that
 * later Player work can consume `live/controlState` and produce
 * `live/playerState`.
 */

export interface LiveControlState {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
}

export interface LivePlayerState {
  activationRevision: number;
  currentVersionId: string;
  appliedControlRevision: number;
  pageId: string;
  pageIndex: number;
}

export const CONTROL_STATE_PATH = "live/controlState";

export const PLAYER_STATE_PATH = "live/playerState";

function isNonNegativeInteger(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function parsePositiveInteger(value: unknown): number | null {
  return isNonNegativeInteger(value) && (value as number) >= 1
    ? (value as number)
    : null;
}

/**
 * Parse and validate `live/controlState`. Rejects malformed values and any
 * unexpected extra key. Returned strings are trimmed.
 */
export function parseLiveControlState(value: unknown): LiveControlState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 4) return null;

  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonEmptyString(record.currentVersionId)) return null;

  const revision = parsePositiveInteger(record.revision);
  if (revision === null) return null;

  if (!isNonEmptyString(record.pageId)) return null;

  return {
    activationRevision: record.activationRevision as number,
    currentVersionId: (record.currentVersionId as string).trim(),
    revision,
    pageId: (record.pageId as string).trim(),
  };
}

/**
 * Parse and validate `live/playerState`. Rejects malformed values and any
 * unexpected extra key. Returned strings are trimmed.
 */
export function parseLivePlayerState(value: unknown): LivePlayerState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 5) return null;

  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonEmptyString(record.currentVersionId)) return null;
  if (!isNonNegativeInteger(record.appliedControlRevision)) return null;
  if (!isNonEmptyString(record.pageId)) return null;
  if (!isNonNegativeInteger(record.pageIndex)) return null;

  return {
    activationRevision: record.activationRevision as number,
    currentVersionId: (record.currentVersionId as string).trim(),
    appliedControlRevision: record.appliedControlRevision as number,
    pageId: (record.pageId as string).trim(),
    pageIndex: record.pageIndex as number,
  };
}