import { onValue, ref, type Database } from "firebase/database";

import type { Presentation } from "@web-slideshow/document-schema";

import type { PlayerController } from "./player";

export const SHAPE_ANIMATION_ACTION_ROOT_PATH = "live/shapeAnimationAction";

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

export interface ShapeAnimationActionTracker {
  prepareBoot(targetBootId: string): void;
  takeIfNew(shapeSlot: number, record: LiveShapeAnimationActionRecord): boolean;
}

export function createLiveShapeAnimationActionTracker(): ShapeAnimationActionTracker {
  let bootId: string | undefined;
  const cursors = new Map<number, { identityKey: string; revision: number }>();
  return {
    prepareBoot(targetBootId): void {
      if (bootId === targetBootId) return;
      bootId = targetBootId;
      cursors.clear();
    },
    takeIfNew(shapeSlot, record): boolean {
      const identityKey = JSON.stringify([
        record.activationRevision, record.currentVersionId, record.pageId,
        record.elementId, record.targetBootId,
      ]);
      const cursor = cursors.get(shapeSlot);
      if (cursor === undefined || cursor.identityKey !== identityKey) {
        cursors.set(shapeSlot, { identityKey, revision: record.revision });
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

export function parseShapeAnimationActionIndex(key: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(key)) return null;
  const value = Number(key);
  return isNonNegativeInteger(value) ? value : null;
}

export function parseLiveShapeAnimationActionRecord(value: unknown): LiveShapeAnimationActionRecord | null {
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

export function subscribeLiveShapeAnimationAction(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  targetBootId: string,
  presentation: Presentation,
  controller: PlayerController,
  tracker: ShapeAnimationActionTracker,
): () => void {
  tracker.prepareBoot(targetBootId);
  const unsubscribe = onValue(ref(database, SHAPE_ANIMATION_ACTION_ROOT_PATH), (snapshot) => {
    for (const [slotKey, value] of numericEntries(snapshot.val())) {
      const shapeSlot = parseShapeAnimationActionIndex(slotKey);
      const record = parseLiveShapeAnimationActionRecord(value);
      if (shapeSlot === null || record === null ||
        record.activationRevision !== activationRevision ||
        record.currentVersionId !== currentVersionId ||
        record.targetBootId !== targetBootId ||
        !tracker.takeIfNew(shapeSlot, record)) continue;
      const currentSlide = presentation.slides[controller.getCurrentIndex()];
      if (currentSlide?.id !== record.pageId) continue;
      controller.controlShapeAnimation?.(record.elementId, record.action);
    }
  });
  return () => unsubscribe();
}
