export interface LiveScriptedInputRecord {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  portId: string;
  targetBootId: string;
  targetMountRevision: number;
  value: boolean | number;
}

const keys = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "portId", "targetBootId", "targetMountRevision", "value"] as const;
const nonNegativeInteger = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
const positiveInteger = (value: unknown): value is number => nonNegativeInteger(value) && value >= 1;
const liveString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const canonicalId = (value: unknown): value is string => typeof value === "string" && value.length > 0;

export function buildScriptedInputRootPath(): string { return "live/scriptedInput"; }
export function buildScriptedInputPath(scriptedSlot: number, portIndex: number): string {
  if (!nonNegativeInteger(scriptedSlot) || !nonNegativeInteger(portIndex)) throw new Error("Scripted input indexes must be non-negative integers.");
  return `${buildScriptedInputRootPath()}/${scriptedSlot}/${portIndex}`;
}

/** Strict transport parser; canonical port semantics stay in Player. */
export function parseLiveScriptedInputRecord(value: unknown): LiveScriptedInputRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key)) ||
    !nonNegativeInteger(record.activationRevision) || !liveString(record.currentVersionId) ||
    !positiveInteger(record.revision) || !liveString(record.pageId) || !canonicalId(record.elementId) ||
    !canonicalId(record.portId) || !liveString(record.targetBootId) || !positiveInteger(record.targetMountRevision) ||
    !(typeof record.value === "boolean" || (typeof record.value === "number" && Number.isFinite(record.value)))) return null;
  return { activationRevision: record.activationRevision, currentVersionId: record.currentVersionId.trim(), revision: record.revision, pageId: record.pageId.trim(), elementId: record.elementId, portId: record.portId, targetBootId: record.targetBootId.trim(), targetMountRevision: record.targetMountRevision, value: record.value };
}
