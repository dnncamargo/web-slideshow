/** One-way Control -> Player Plot animation action occurrence contract. */
export type PlotAnimationAction = "play" | "pause" | "reset";

export interface LivePlotAnimationActionRecord {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  targetBootId: string;
  action: PlotAnimationAction;
}

export function buildPlotAnimationActionRootPath(): string {
  return "live/plotAnimationAction";
}

export function buildPlotAnimationActionPath(plotSlot: number): string {
  if (!isNonNegativeInteger(plotSlot)) {
    throw new Error("Plot animation action slot must be a non-negative integer.");
  }
  return `${buildPlotAnimationActionRootPath()}/${plotSlot}`;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isCanonicalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPlotAnimationAction(value: unknown): value is PlotAnimationAction {
  return value === "play" || value === "pause" || value === "reset";
}

/** Strictly parses a Plot action occurrence without altering canonical ids. */
export function parseLivePlotAnimationActionRecord(
  value: unknown,
): LivePlotAnimationActionRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = [
    "activationRevision", "currentVersionId", "revision", "pageId",
    "elementId", "targetBootId", "action",
  ];
  if (Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key))) return null;
  if (!isNonNegativeInteger(record.activationRevision) || !isNonEmptyString(record.currentVersionId) ||
    !isNonNegativeInteger(record.revision) || record.revision < 1 || !isNonEmptyString(record.pageId) ||
    !isCanonicalId(record.elementId) || !isNonEmptyString(record.targetBootId) ||
    !isPlotAnimationAction(record.action)) return null;
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
