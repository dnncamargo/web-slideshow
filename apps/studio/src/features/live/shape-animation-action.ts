import { buildAuthenticatedLivePath } from "./live-path";

/** One-way Control -> Player Shape animation action occurrence contract. */
export type ShapeAnimationAction = "play" | "pause" | "reset";

export interface LiveShapeAnimationActionRecord {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  targetBootId: string;
  action: ShapeAnimationAction;
}

export function buildShapeAnimationActionRootPath(): string {
  return buildAuthenticatedLivePath("shapeAnimationAction");
}

export function buildShapeAnimationActionPath(shapeSlot: number): string {
  if (!isNonNegativeInteger(shapeSlot)) {
    throw new Error("Shape animation action slot must be a non-negative integer.");
  }
  return `${buildShapeAnimationActionRootPath()}/${shapeSlot}`;
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

function isShapeAnimationAction(value: unknown): value is ShapeAnimationAction {
  return value === "play" || value === "pause" || value === "reset";
}

/** Strictly parses a Shape action occurrence without altering canonical ids. */
export function parseLiveShapeAnimationActionRecord(
  value: unknown,
): LiveShapeAnimationActionRecord | null {
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
    !isShapeAnimationAction(record.action)) return null;
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
