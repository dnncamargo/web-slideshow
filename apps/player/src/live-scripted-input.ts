import { onValue, ref, type Database } from "firebase/database";
import { visitSlideElements, type Presentation, type ScriptedElement } from "@powershow/document-schema";
import type { PlayerController } from "./player";

export const SCRIPTED_INPUT_ROOT_PATH = "live/scriptedInput";
export interface LiveScriptedInputRecord { activationRevision: number; currentVersionId: string; revision: number; pageId: string; elementId: string; portId: string; targetBootId: string; targetMountRevision: number; value: boolean | number; }
const keys = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "portId", "targetBootId", "targetMountRevision", "value"] as const;
const nonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
const positive = (value: unknown): value is number => nonNegative(value) && value >= 1;
const liveString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0;
export function parseLiveScriptedInputRecord(value: unknown): LiveScriptedInputRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key)) || !nonNegative(record.activationRevision) || !liveString(record.currentVersionId) || !positive(record.revision) || !liveString(record.pageId) || !id(record.elementId) || !id(record.portId) || !liveString(record.targetBootId) || !positive(record.targetMountRevision) || !(typeof record.value === "boolean" || (typeof record.value === "number" && Number.isFinite(record.value)))) return null;
  return { activationRevision: record.activationRevision, currentVersionId: record.currentVersionId.trim(), revision: record.revision, pageId: record.pageId.trim(), elementId: record.elementId, portId: record.portId, targetBootId: record.targetBootId.trim(), targetMountRevision: record.targetMountRevision, value: record.value };
}
export function createLiveScriptedInputTracker() {
  const cursors = new Map<string, { identity: string; revision: number }>();
  return { take(slot: number, port: number, record: LiveScriptedInputRecord): boolean {
    const address = `${slot}:${port}`;
    const identity = JSON.stringify([record.activationRevision, record.currentVersionId, record.pageId, record.elementId, record.portId, record.targetBootId, record.targetMountRevision]);
    const previous = cursors.get(address);
    if (!previous || previous.identity !== identity) { cursors.set(address, { identity, revision: record.revision }); return true; }
    if (record.revision <= previous.revision) return false;
    previous.revision = record.revision; return true;
  } };
}
function entries(value: unknown): Array<[string, unknown]> { return value !== null && typeof value === "object" ? Object.entries(value) : []; }
function index(key: string): number | null { return /^(0|[1-9]\d*)$/.test(key) && nonNegative(Number(key)) ? Number(key) : null; }
function scripteds(presentation: Presentation, pageId: string): ScriptedElement[] | null { const page = presentation.slides.find((slide) => slide.id === pageId); if (!page) return null; const found: ScriptedElement[] = []; visitSlideElements(page, (element) => { if (element.type === "scripted") found.push(element); }); return found; }
export function subscribeLiveScriptedInput(database: Database, activationRevision: number, currentVersionId: string, bootId: string, presentation: Presentation, controller: PlayerController, getCurrentMount: (slot: number) => { pageId: string; elementId: string; mountRevision: number } | null, tracker: ReturnType<typeof createLiveScriptedInputTracker>): () => void {
  const unsubscribe = onValue(ref(database, SCRIPTED_INPUT_ROOT_PATH), (snapshot) => {
    for (const [slotKey, ports] of entries(snapshot.val())) for (const [portKey, candidate] of entries(ports)) {
      const slot = index(slotKey); const portIndex = index(portKey); const record = parseLiveScriptedInputRecord(candidate);
      if (slot === null || portIndex === null || !record || record.activationRevision !== activationRevision || record.currentVersionId !== currentVersionId || record.targetBootId !== bootId) continue;
      const page = presentation.slides[controller.getCurrentIndex()];
      const currentScripteds = page ? scripteds(presentation, page.id) : null;
      const scripted = currentScripteds?.[slot]; const port = scripted?.ports[portIndex]; const mount = getCurrentMount(slot);
      const applicable = page?.id === record.pageId && scripted?.id === record.elementId && port?.id === record.portId && (port?.kind === "boolean" || port?.kind === "number") && (port.direction === "input" || port.direction === "input-output") && (port.kind === "boolean" ? typeof record.value === "boolean" : typeof record.value === "number" && Number.isFinite(record.value) && (port.min === undefined || record.value >= port.min) && (port.max === undefined || record.value <= port.max)) && mount?.pageId === record.pageId && mount.elementId === record.elementId && mount.mountRevision === record.targetMountRevision;
      const newer = tracker.take(slot, portIndex, record);
      if (applicable && newer) controller.sendScriptedInput(record.elementId, record.portId, record.value);
    }
  });
  return () => unsubscribe();
}
