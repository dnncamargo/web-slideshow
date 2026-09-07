import type { PlotAnimationAction } from "../../studio/src/features/live/plot-animation-action";

export const PLOT_ANIMATION_ACTION_ROOT_PATH = "live/plotAnimationAction";

export interface LivePlotAnimationActionRecord {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  targetBootId: string;
  action: PlotAnimationAction;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}
function isNonEmptyString(value: unknown): value is string { return typeof value === "string" && value.trim() !== ""; }
function isCanonicalId(value: unknown): value is string { return typeof value === "string" && value.length > 0; }

export function parsePlotAnimationActionIndex(key: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(key)) return null;
  const value = Number(key);
  return isNonNegativeInteger(value) ? value : null;
}

export function parseLivePlotAnimationActionRecord(value: unknown): LivePlotAnimationActionRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "targetBootId", "action"];
  if (Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key))) return null;
  if (!isNonNegativeInteger(record.activationRevision) || !isNonEmptyString(record.currentVersionId) ||
    !isNonNegativeInteger(record.revision) || record.revision < 1 || !isNonEmptyString(record.pageId) ||
    !isCanonicalId(record.elementId) || !isNonEmptyString(record.targetBootId) ||
    !(record.action === "play" || record.action === "pause" || record.action === "reset")) return null;
  return {
    activationRevision: record.activationRevision,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision,
    pageId: record.pageId.trim(),
    elementId: record.elementId,
    targetBootId: record.targetBootId.trim(),
    action: record.action,
  };
}
