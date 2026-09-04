/** One-way Control -> Player Scripted action occurrence wire contract. */
export interface LiveScriptedActionRecord {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  portId: string;
  targetBootId: string;
}

export function buildScriptedActionRootPath(): string {
  return "live/scriptedAction";
}

export function buildScriptedActionPath(
  scriptedSlot: number,
  portIndex: number,
): string {
  if (!isNonNegativeInteger(scriptedSlot)) {
    throw new Error("Scripted action slot must be a non-negative integer.");
  }
  if (!isNonNegativeInteger(portIndex)) {
    throw new Error("Scripted action port index must be a non-negative integer.");
  }

  return `${buildScriptedActionRootPath()}/${scriptedSlot}/${portIndex}`;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isCanonicalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Strictly parses an action occurrence without altering canonical ids. */
export function parseLiveScriptedActionRecord(
  value: unknown,
): LiveScriptedActionRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const keys = [
    "activationRevision",
    "currentVersionId",
    "revision",
    "pageId",
    "elementId",
    "portId",
    "targetBootId",
  ];
  if (
    Object.keys(record).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(record, key))
  ) {
    return null;
  }
  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonEmptyString(record.currentVersionId)) return null;
  if (!isNonNegativeInteger(record.revision) || record.revision < 1) return null;
  if (!isNonEmptyString(record.pageId)) return null;
  if (!isCanonicalId(record.elementId)) return null;
  if (!isCanonicalId(record.portId)) return null;
  if (!isNonEmptyString(record.targetBootId)) return null;

  return {
    activationRevision: record.activationRevision,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision,
    pageId: record.pageId.trim(),
    elementId: record.elementId,
    portId: record.portId,
    targetBootId: record.targetBootId.trim(),
  };
}
