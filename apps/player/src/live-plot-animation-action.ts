import { onValue, ref, type Database } from "firebase/database";

import type { Presentation } from "@powershow/document-schema";

import type { PlayerController } from "./player";

export const PLOT_ANIMATION_ACTION_ROOT_PATH = "live/plotAnimationAction";

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

export interface PlotAnimationActionTracker {
  prepareBoot(targetBootId: string): void;
  takeIfNew(plotSlot: number, record: LivePlotAnimationActionRecord): boolean;
}

export function createLivePlotAnimationActionTracker(): PlotAnimationActionTracker {
  let bootId: string | undefined;
  const cursors = new Map<number, { identityKey: string; revision: number }>();
  return {
    prepareBoot(targetBootId): void {
      if (bootId === targetBootId) return;
      bootId = targetBootId;
      cursors.clear();
    },
    takeIfNew(plotSlot, record): boolean {
      const identityKey = JSON.stringify([
        record.activationRevision, record.currentVersionId, record.pageId,
        record.elementId, record.targetBootId,
      ]);
      const cursor = cursors.get(plotSlot);
      if (cursor === undefined || cursor.identityKey !== identityKey) {
        cursors.set(plotSlot, { identityKey, revision: record.revision });
        return true;
      }
      if (record.revision <= cursor.revision) return false;
      cursor.revision = record.revision;
      return true;
    },
  };
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

function numericEntries(value: unknown): Array<[string, unknown]> {
  return value !== null && typeof value === "object" ? Object.entries(value) : [];
}

/** Consumes Plot action occurrences without replaying revision gaps. */
export function subscribeLivePlotAnimationAction(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  targetBootId: string,
  presentation: Presentation,
  controller: PlayerController,
  tracker: PlotAnimationActionTracker,
): () => void {
  tracker.prepareBoot(targetBootId);
  const unsubscribe = onValue(ref(database, PLOT_ANIMATION_ACTION_ROOT_PATH), (snapshot) => {
    for (const [slotKey, value] of numericEntries(snapshot.val())) {
      const plotSlot = parsePlotAnimationActionIndex(slotKey);
      const record = parseLivePlotAnimationActionRecord(value);
      if (plotSlot === null || record === null ||
        record.activationRevision !== activationRevision ||
        record.currentVersionId !== currentVersionId ||
        record.targetBootId !== targetBootId ||
        !tracker.takeIfNew(plotSlot, record)) continue;

      const currentSlide = presentation.slides[controller.getCurrentIndex()];
      if (currentSlide?.id !== record.pageId) continue;
      controller.controlPlotAnimation(record.elementId, record.action);
    }
  });
  return () => unsubscribe();
}
