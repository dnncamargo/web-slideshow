export interface LiveScriptedRuntimeRecord {
  activationRevision: number; currentVersionId: string; mountRevision: number; pageId: string; elementId: string; bootId: string;
}
export interface LiveScriptedReportRecord {
  activationRevision: number; currentVersionId: string; revision: number; pageId: string; elementId: string; portId: string; sourceBootId: string; mountRevision: number; appliedInputRevision: number; value: boolean | number;
}
const finiteInteger = (value: unknown, minimum: number) => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= minimum;
const liveString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0;
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }

export function parseLiveScriptedRuntimeRecord(value: unknown): LiveScriptedRuntimeRecord | null {
  const keys = ["activationRevision", "currentVersionId", "mountRevision", "pageId", "elementId", "bootId"] as const;
  if (!exact(value, keys) || !finiteInteger(value.activationRevision, 0) || !liveString(value.currentVersionId) || !finiteInteger(value.mountRevision, 1) || !liveString(value.pageId) || !id(value.elementId) || !liveString(value.bootId)) return null;
  return { activationRevision: value.activationRevision as number, currentVersionId: (value.currentVersionId as string).trim(), mountRevision: value.mountRevision as number, pageId: (value.pageId as string).trim(), elementId: value.elementId as string, bootId: (value.bootId as string).trim() };
}

export function parseLiveScriptedReportRecord(value: unknown): LiveScriptedReportRecord | null {
  const keys = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "portId", "sourceBootId", "mountRevision", "appliedInputRevision", "value"] as const;
  if (!exact(value, keys) || !finiteInteger(value.activationRevision, 0) || !liveString(value.currentVersionId) || !finiteInteger(value.revision, 1) || !liveString(value.pageId) || !id(value.elementId) || !id(value.portId) || !liveString(value.sourceBootId) || !finiteInteger(value.mountRevision, 1) || !finiteInteger(value.appliedInputRevision, 0) || !(typeof value.value === "boolean" || (typeof value.value === "number" && Number.isFinite(value.value)))) return null;
  return { activationRevision: value.activationRevision as number, currentVersionId: (value.currentVersionId as string).trim(), revision: value.revision as number, pageId: (value.pageId as string).trim(), elementId: value.elementId as string, portId: value.portId as string, sourceBootId: (value.sourceBootId as string).trim(), mountRevision: value.mountRevision as number, appliedInputRevision: value.appliedInputRevision as number, value: value.value as boolean | number };
}
