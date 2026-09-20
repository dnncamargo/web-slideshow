import { ref, runTransaction, set, type Database } from "firebase/database";

import {
  visitSlideElements,
  type MaterializedSlide,
  type Presentation,
  type ScriptedElement,
} from "@web-slideshow/document-schema";
import type { ScriptedReportMessage } from "@web-slideshow/renderer";

export const SCRIPTED_RUNTIME_ROOT_PATH = "live/scriptedRuntime";
export const SCRIPTED_REPORT_ROOT_PATH = "live/scriptedReport";

export interface LiveScriptedRuntimeRecord {
  activationRevision: number;
  currentVersionId: string;
  mountRevision: number;
  pageId: string;
  elementId: string;
  bootId: string;
}

export interface LiveScriptedReportRecord {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  portId: string;
  sourceBootId: string;
  mountRevision: number;
  appliedInputRevision: number;
  value: boolean | number;
}

interface MountContext extends LiveScriptedRuntimeRecord {
  scriptedSlot: number;
  scripted: ScriptedElement;
  runtimeWrite: Promise<void>;
  appliedInputs: Map<number, number>;
}

export interface LiveScriptedStatePublisherOptions {
  database: Database;
  activationRevision: number;
  currentVersionId: string;
  bootId: string;
  presentation: Presentation;
  allocateMountRevision(): number;
  isCurrent(): boolean;
  getCurrentPageId(): string | null;
  onRuntimeWriteError?(): void;
  onReportWriteError?(): void;
}

function nonEmptyLiveString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function canonicalId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]";
}

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return plainRecord(value) && Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function scriptedsOnSlide(slide: MaterializedSlide): ScriptedElement[] {
  const scripteds: ScriptedElement[] = [];
  visitSlideElements(slide, (element) => {
    if (element.type === "scripted") scripteds.push(element);
  });
  return scripteds;
}

export function parseLiveScriptedRuntimeRecord(value: unknown): LiveScriptedRuntimeRecord | null {
  const keys = ["activationRevision", "currentVersionId", "mountRevision", "pageId", "elementId", "bootId"] as const;
  if (!exactRecord(value, keys) || !nonNegativeInteger(value.activationRevision) ||
    !nonEmptyLiveString(value.currentVersionId) || !positiveInteger(value.mountRevision) ||
    !nonEmptyLiveString(value.pageId) || !canonicalId(value.elementId) || !nonEmptyLiveString(value.bootId)) return null;
  return { activationRevision: value.activationRevision, currentVersionId: value.currentVersionId.trim(), mountRevision: value.mountRevision, pageId: value.pageId.trim(), elementId: value.elementId, bootId: value.bootId.trim() };
}

export function parseLiveScriptedReportRecord(value: unknown): LiveScriptedReportRecord | null {
  const keys = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "portId", "sourceBootId", "mountRevision", "appliedInputRevision", "value"] as const;
  if (!exactRecord(value, keys) || !nonNegativeInteger(value.activationRevision) ||
    !nonEmptyLiveString(value.currentVersionId) || !positiveInteger(value.revision) ||
    !nonEmptyLiveString(value.pageId) || !canonicalId(value.elementId) || !canonicalId(value.portId) ||
    !nonEmptyLiveString(value.sourceBootId) || !positiveInteger(value.mountRevision) ||
    !nonNegativeInteger(value.appliedInputRevision) ||
    !(typeof value.value === "boolean" || (typeof value.value === "number" && Number.isFinite(value.value)))) return null;
  return { activationRevision: value.activationRevision, currentVersionId: value.currentVersionId.trim(), revision: value.revision, pageId: value.pageId.trim(), elementId: value.elementId, portId: value.portId, sourceBootId: value.sourceBootId.trim(), mountRevision: value.mountRevision, appliedInputRevision: value.appliedInputRevision, value: value.value };
}

function validOutputValue(port: ScriptedElement["ports"][number], value: boolean | number): boolean {
  if (port.kind === "boolean") return (port.direction === "output" || port.direction === "input-output") && typeof value === "boolean";
  return port.kind === "number" && (port.direction === "output" || port.direction === "input-output") && typeof value === "number" && Number.isFinite(value) && (port.min === undefined || value >= port.min) && (port.max === undefined || value <= port.max);
}

/** Publishes only the Player-owned identity and validated Scripted output state. */
export function createLiveScriptedStatePublisher(options: LiveScriptedStatePublisherOptions): {
  onScriptedMount(event: {
    pageId: string;
    elementId: string;
    slide: MaterializedSlide;
  }): void;
  onScriptedReport(report: ScriptedReportMessage): void;
  getCurrentMount(scriptedSlot: number): { pageId: string; elementId: string; mountRevision: number } | null;
  markAppliedInput(input: { scriptedSlot: number; portIndex: number; pageId: string; elementId: string; portId: string; mountRevision: number; revision: number }): void;
} {
  const contexts = new Map<string, MountContext>();

  function onScriptedMount(event: {
    pageId: string;
    elementId: string;
    slide: MaterializedSlide;
  }): void {
    if (!options.isCurrent()) return;
    const scripteds = scriptedsOnSlide(event.slide);
    const scriptedSlot = scripteds?.findIndex((element) => element.id === event.elementId) ?? -1;
    if (scriptedSlot < 0) return;
    const scripted = scripteds?.[scriptedSlot];
    if (!scripted) return;
    const mountRevision = options.allocateMountRevision();
    const context: MountContext = {
      activationRevision: options.activationRevision, currentVersionId: options.currentVersionId,
      mountRevision, pageId: event.pageId, elementId: event.elementId, bootId: options.bootId,
      scriptedSlot, scripted, runtimeWrite: Promise.resolve(), appliedInputs: new Map(),
    };
    context.runtimeWrite = set(ref(options.database, `${SCRIPTED_RUNTIME_ROOT_PATH}/${scriptedSlot}`), {
      activationRevision: context.activationRevision, currentVersionId: context.currentVersionId,
      mountRevision: context.mountRevision, pageId: context.pageId, elementId: context.elementId, bootId: context.bootId,
    }).catch(() => { options.onRuntimeWriteError?.(); throw new Error("scripted runtime write failed"); });
    contexts.set(event.elementId, context);
  }

  function onScriptedReport(report: ScriptedReportMessage): void {
    const context = contexts.get(report.elementId);
    if (!context || !options.isCurrent() || options.getCurrentPageId() !== context.pageId) return;
    const scripted = context.scripted;
    const portIndex = scripted?.ports.findIndex((port) => port.id === report.portId) ?? -1;
    const port = portIndex >= 0 ? scripted?.ports[portIndex] : undefined;
    if (!scripted || scripted.id !== context.elementId || !port || !validOutputValue(port, report.value)) return;
    const appliedInputRevision = (port.kind === "boolean" || port.kind === "number") && port.direction === "input-output" ? context.appliedInputs.get(portIndex) ?? 0 : 0;
    void context.runtimeWrite.then(() => {
      if (!options.isCurrent() || options.getCurrentPageId() !== context.pageId || contexts.get(report.elementId) !== context) return;
      const reportRef = ref(options.database, `${SCRIPTED_REPORT_ROOT_PATH}/${context.scriptedSlot}/${portIndex}`);
      return runTransaction(reportRef, (existing: unknown) => {
        if (!options.isCurrent() || options.getCurrentPageId() !== context.pageId || contexts.get(report.elementId) !== context) return;
        const previous = parseLiveScriptedReportRecord(existing);
        const sameRuntime = previous && previous.activationRevision === context.activationRevision && previous.currentVersionId === context.currentVersionId && previous.pageId === context.pageId && previous.elementId === context.elementId && previous.portId === report.portId && previous.sourceBootId === context.bootId && previous.mountRevision === context.mountRevision;
        return { activationRevision: context.activationRevision, currentVersionId: context.currentVersionId, revision: sameRuntime ? previous.revision + 1 : 1, pageId: context.pageId, elementId: context.elementId, portId: report.portId, sourceBootId: context.bootId, mountRevision: context.mountRevision, appliedInputRevision, value: report.value };
      }).catch(() => { options.onReportWriteError?.(); });
    }, () => undefined);
  }
  function getCurrentMount(scriptedSlot: number): { pageId: string; elementId: string; mountRevision: number } | null {
    if (!Number.isInteger(scriptedSlot) || scriptedSlot < 0 || !options.isCurrent()) return null;
    const pageId = options.getCurrentPageId();
    if (pageId === null) return null;
    const context = Array.from(contexts.values()).find((candidate) =>
      candidate.pageId === pageId && candidate.scriptedSlot === scriptedSlot &&
      contexts.get(candidate.elementId) === candidate,
    );
    if (!context) return null;
    return { pageId: context.pageId, elementId: context.elementId, mountRevision: context.mountRevision };
  }
  function markAppliedInput(input: { scriptedSlot: number; portIndex: number; pageId: string; elementId: string; portId: string; mountRevision: number; revision: number }): void {
    if (!positiveInteger(input.revision) || !options.isCurrent() || options.getCurrentPageId() !== input.pageId) return;
    const context = Array.from(contexts.values()).find((candidate) =>
      candidate.pageId === input.pageId && candidate.scriptedSlot === input.scriptedSlot &&
      contexts.get(candidate.elementId) === candidate,
    ); const scripted = context?.scripted; const port = scripted?.ports[input.portIndex];
    if (!scripted || !context || context.scriptedSlot !== input.scriptedSlot || context.elementId !== input.elementId || context.mountRevision !== input.mountRevision || !port || port.id !== input.portId || (port.kind !== "boolean" && port.kind !== "number") || port.direction !== "input-output") return;
    const previous = context.appliedInputs.get(input.portIndex) ?? 0; if (input.revision > previous) context.appliedInputs.set(input.portIndex, input.revision);
  }
  return { onScriptedMount, onScriptedReport, getCurrentMount, markAppliedInput };
}
