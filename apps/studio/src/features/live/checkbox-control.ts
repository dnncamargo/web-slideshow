import { buildAuthenticatedLivePath } from "./live-path";
import type { CheckboxRuntimeState } from "@web-slideshow/renderer";

/** One-way Control -> Player Checkbox desired-state wire contract. */
export interface LiveCheckboxControlState {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  checkboxId: string;
  state: CheckboxRuntimeState;
}

export function buildCheckboxControlRootPath(): string {
  return buildAuthenticatedLivePath("checkboxControl");
}

export function buildCheckboxControlSlotPath(slot: number): string {
  if (!isNonNegativeInteger(slot)) {
    throw new Error("Checkbox control slot must be a non-negative integer.");
  }

  return `${buildCheckboxControlRootPath()}/${slot}`;
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

function isCheckboxRuntimeState(value: unknown): value is CheckboxRuntimeState {
  return value === "unchecked" || value === "intermediate" || value === "checked";
}

/** Strictly parses a Checkbox record without altering canonical ids. */
export function parseLiveCheckboxControlState(
  value: unknown,
): LiveCheckboxControlState | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 7) return null;
  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonEmptyString(record.currentVersionId)) return null;
  if (!isNonNegativeInteger(record.revision) || record.revision < 1) return null;
  if (!isNonEmptyString(record.pageId)) return null;
  if (!isCanonicalId(record.elementId)) return null;
  if (!isCanonicalId(record.checkboxId)) return null;
  if (!isCheckboxRuntimeState(record.state)) return null;

  return {
    activationRevision: record.activationRevision,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision,
    pageId: record.pageId.trim(),
    elementId: record.elementId,
    checkboxId: record.checkboxId,
    state: record.state,
  };
}
