import { onChildAdded, onChildChanged, ref, type Database } from "firebase/database";

import type { CheckboxRuntimeState } from "@web-slideshow/renderer";

import type { PlayerController } from "./player";
import { buildLivePath } from "./live-path";

export const CHECKBOX_CONTROL_ROOT_PATH = "checkboxControl";

export interface LiveCheckboxControlState {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  checkboxId: string;
  state: CheckboxRuntimeState;
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

function isCheckboxRuntimeState(value: unknown): value is CheckboxRuntimeState {
  return value === "unchecked" || value === "intermediate" || value === "checked";
}

/** Strict parser for the one-way Checkbox command record. */
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
  if (typeof record.elementId !== "string" || record.elementId.length === 0) return null;
  if (typeof record.checkboxId !== "string" || record.checkboxId.length === 0) return null;
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

function parseSlot(key: string | null): number | null {
  if (key === null || !/^(0|[1-9]\d*)$/.test(key)) return null;
  const slot = Number(key);
  return Number.isSafeInteger(slot) && slot >= 0 ? slot : null;
}

/** Subscribes to one-way Control -> Player Checkbox desired state. */
export function subscribeLiveCheckboxControl(
  database: Database,
  ownerUid: string,
  activationRevision: number,
  currentVersionId: string,
  controller: PlayerController,
): () => void {
  function apply(snapshot: { key: string | null; val(): unknown }): void {
    const slot = parseSlot(snapshot.key);
    const state = parseLiveCheckboxControlState(snapshot.val());
    if (
      slot === null ||
      state === null ||
      state.activationRevision !== activationRevision ||
      state.currentVersionId !== currentVersionId
    ) return;

    controller.setCheckboxControlState(
      slot,
      state.pageId,
      state.elementId,
      state.checkboxId,
      state.state,
    );
  }

  const root = ref(database, buildLivePath(ownerUid, CHECKBOX_CONTROL_ROOT_PATH));
  const unsubscribeAdded = onChildAdded(root, apply);
  const unsubscribeChanged = onChildChanged(root, apply);

  return () => {
    unsubscribeAdded();
    unsubscribeChanged();
  };
}
