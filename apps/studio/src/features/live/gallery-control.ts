/** One-way Control -> Player Gallery intent wire contract. */
export interface LiveGalleryControlState {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  targetIndex: number;
  expanded: boolean;
}

export function buildGalleryControlRootPath(): string {
  return "live/galleryControl";
}

export function buildGalleryControlSlotPath(slot: number): string {
  if (!isNonNegativeInteger(slot)) {
    throw new Error("Gallery control slot must be a non-negative integer.");
  }

  return `${buildGalleryControlRootPath()}/${slot}`;
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

function isCanonicalElementId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Strictly parses a Gallery record without altering its canonical element id. */
export function parseLiveGalleryControlState(
  value: unknown,
): LiveGalleryControlState | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 7) return null;
  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonEmptyString(record.currentVersionId)) return null;
  if (!isNonNegativeInteger(record.revision) || record.revision < 1) return null;
  if (!isNonEmptyString(record.pageId)) return null;
  if (!isCanonicalElementId(record.elementId)) return null;
  if (!isNonNegativeInteger(record.targetIndex)) return null;
  if (typeof record.expanded !== "boolean") return null;

  return {
    activationRevision: record.activationRevision,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision,
    pageId: record.pageId.trim(),
    elementId: record.elementId,
    targetIndex: record.targetIndex,
    expanded: record.expanded,
  };
}
