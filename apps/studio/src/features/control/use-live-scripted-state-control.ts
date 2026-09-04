"use client";

import { onValue, ref } from "firebase/database";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Presentation, visitSlideElements } from "@powershow/document-schema";
import { writeScriptedInput } from "./control-command-writer";
import type { LiveCurrent } from "./live-current";
import type { PlayerOperationalStatus } from "./player-presence";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { parseLiveScriptedInputRecord, type LiveScriptedInputRecord } from "../live/scripted-input";
import { parseLiveScriptedReportRecord, parseLiveScriptedRuntimeRecord, type LiveScriptedReportRecord, type LiveScriptedRuntimeRecord } from "../live/scripted-state";

type StatefulKind = "boolean" | "number";
type Direction = "input" | "output" | "input-output";
export type ControlScriptedPortStatus = "unavailable" | "awaiting-report" | "ready" | "pending" | "divergent";
export interface ControlScriptedStatePort { portIndex: number; portId: string; label: string; kind: StatefulKind; direction: Direction; min?: number; max?: number; step?: number; runtimeKey: string | null; runtimeAvailable: boolean; desiredValue: boolean | number | null; desiredRevision: number | null; reportedValue: boolean | number | null; reportRevision: number | null; appliedInputRevision: number | null; status: ControlScriptedPortStatus; writable: boolean; }
export interface ControlScriptedStateGroup { scriptedSlot: number; elementId: string; title: string; ports: readonly ControlScriptedStatePort[]; }
export interface UseLiveScriptedStateControlOptions { live: LiveCurrent | null; livePresentation: Presentation | null; desiredPageId: string | null; actualPageId: string | null; controlSynced: boolean; playerStatus: PlayerOperationalStatus | null; controlsBlocked: boolean; }
export interface UseLiveScriptedStateControlResult { groups: readonly ControlScriptedStateGroup[]; controlsEnabled: boolean; sendFailed: boolean; setPortValue(scriptedSlot: number, portIndex: number, value: boolean | number): void; }
interface DescriptorPort { portIndex: number; portId: string; label: string; kind: StatefulKind; direction: Direction; min?: number; max?: number; step?: number; }
interface DescriptorGroup { scriptedSlot: number; elementId: string; title: string; ports: readonly DescriptorPort[]; }
interface Hydrated { runtime: unknown; input: unknown; report: unknown; }
interface Latest extends UseLiveScriptedStateControlOptions { groups: readonly DescriptorGroup[]; hydrated: Hydrated; }
interface StatefulCommandContext { activationRevision: number; currentVersionId: string; pageId: string; scriptedSlot: number; elementId: string; portIndex: number; portId: string; targetBootId: string; targetMountRevision: number; }

function entries(value: unknown): Array<[string, unknown]> { return value !== null && typeof value === "object" ? Object.entries(value) : []; }
function at(root: unknown, slot: number, port?: number): unknown { const slotValue = entries(root).find(([key]) => key === String(slot))?.[1]; return port === undefined ? slotValue : entries(slotValue).find(([key]) => key === String(port))?.[1]; }
function discover(presentation: Presentation | null, pageId: string | null): DescriptorGroup[] {
  const slide = presentation?.slides.find((candidate) => candidate.id === pageId); if (!slide) return [];
  const groups: DescriptorGroup[] = []; let slot = 0;
  visitSlideElements(slide, (element) => { if (element.type !== "scripted") return; const ports = element.ports.flatMap((port, portIndex) => port.kind === "boolean" || port.kind === "number" ? [{ portIndex, portId: port.id, label: port.label, kind: port.kind, direction: port.direction, ...(port.kind === "number" && port.min !== undefined ? { min: port.min } : {}), ...(port.kind === "number" && port.max !== undefined ? { max: port.max } : {}), ...(port.kind === "number" && port.step !== undefined ? { step: port.step } : {}) }] : []); if (ports.length) groups.push({ scriptedSlot: slot, elementId: element.id, title: element.title, ports }); slot += 1; });
  return groups;
}
function safe(current: Latest): boolean { return current.live !== null && current.desiredPageId !== null && current.actualPageId === current.desiredPageId && current.controlSynced && !current.controlsBlocked && current.playerStatus?.kind === "ready"; }
function runtimeFor(current: Latest, group: DescriptorGroup): LiveScriptedRuntimeRecord | null { const runtime = parseLiveScriptedRuntimeRecord(at(current.hydrated.runtime, group.scriptedSlot)); return runtime && current.live && current.desiredPageId && current.playerStatus?.kind === "ready" && runtime.activationRevision === current.live.revision && runtime.currentVersionId === current.live.currentVersionId && runtime.pageId === current.desiredPageId && runtime.elementId === group.elementId && runtime.bootId === current.playerStatus.presence.bootId ? runtime : null; }
function inputFor(current: Latest, group: DescriptorGroup, port: DescriptorPort, runtime: LiveScriptedRuntimeRecord): LiveScriptedInputRecord | null { const input = parseLiveScriptedInputRecord(at(current.hydrated.input, group.scriptedSlot, port.portIndex)); return input && current.live && current.desiredPageId && input.activationRevision === current.live.revision && input.currentVersionId === current.live.currentVersionId && input.pageId === current.desiredPageId && input.elementId === group.elementId && input.portId === port.portId && input.targetBootId === runtime.bootId && input.targetMountRevision === runtime.mountRevision ? input : null; }
function reportFor(current: Latest, group: DescriptorGroup, port: DescriptorPort, runtime: LiveScriptedRuntimeRecord): LiveScriptedReportRecord | null { const report = parseLiveScriptedReportRecord(at(current.hydrated.report, group.scriptedSlot, port.portIndex)); return report && current.live && current.desiredPageId && report.activationRevision === current.live.revision && report.currentVersionId === current.live.currentVersionId && report.pageId === current.desiredPageId && report.elementId === group.elementId && report.portId === port.portId && report.sourceBootId === runtime.bootId && report.mountRevision === runtime.mountRevision ? report : null; }
function viewPort(current: Latest, group: DescriptorGroup, port: DescriptorPort): ControlScriptedStatePort {
  const runtime = runtimeFor(current, group); if (!runtime) return { ...port, runtimeKey: null, runtimeAvailable: false, desiredValue: null, desiredRevision: null, reportedValue: null, reportRevision: null, appliedInputRevision: null, status: "unavailable", writable: false };
  const input = port.direction === "output" ? null : inputFor(current, group, port, runtime); const report = port.direction === "input" ? null : reportFor(current, group, port, runtime);
  let status: ControlScriptedPortStatus;
  if (port.direction === "input") status = "ready";
  else if (port.direction === "output" || !input) status = report ? "ready" : "awaiting-report";
  else if (!report || report.appliedInputRevision < input.revision) status = "pending";
  else status = report.value === input.value ? "ready" : "divergent";
  return { ...port, runtimeKey: JSON.stringify([runtime.bootId, runtime.mountRevision]), runtimeAvailable: true, desiredValue: input?.value ?? null, desiredRevision: input?.revision ?? null, reportedValue: report?.value ?? null, reportRevision: report?.revision ?? null, appliedInputRevision: report?.appliedInputRevision ?? null, status, writable: safe(current) && (port.direction === "input" || port.direction === "input-output") };
}
function find(current: Latest, slot: number, port: number) { const group = current.groups.find((candidate) => candidate.scriptedSlot === slot); const descriptor = group?.ports.find((candidate) => candidate.portIndex === port); return group && descriptor ? { group, descriptor } : null; }
function valid(port: DescriptorPort, value: boolean | number): boolean { return port.kind === "boolean" ? typeof value === "boolean" : typeof value === "number" && Number.isFinite(value) && (port.min === undefined || value >= port.min) && (port.max === undefined || value <= port.max); }
function commandMatchesCurrentContext(command: StatefulCommandContext, current: Latest): boolean { const found = find(current, command.scriptedSlot, command.portIndex); const runtime = found && runtimeFor(current, found.group); return found !== null && found.group.elementId === command.elementId && found.descriptor.portId === command.portId && current.live?.revision === command.activationRevision && current.live?.currentVersionId === command.currentVersionId && current.desiredPageId === command.pageId && runtime?.bootId === command.targetBootId && runtime.mountRevision === command.targetMountRevision; }

/** Hydrates canonical stateful Scripted ports for the current Control live context. */
export function useLiveScriptedStateControl(options: UseLiveScriptedStateControlOptions): UseLiveScriptedStateControlResult {
  const descriptors = useMemo(() => discover(options.livePresentation, options.desiredPageId), [options.livePresentation, options.desiredPageId]);
  const [hydrated, setHydrated] = useState<Hydrated>({ runtime: null, input: null, report: null }); const [failedCommand, setFailedCommand] = useState<StatefulCommandContext | null>(null);
  useEffect(() => { const database = getRealtimeDatabaseOrNull(); if (!database || !options.live) { setHydrated({ runtime: null, input: null, report: null }); return; } const runtime = onValue(ref(database, "live/scriptedRuntime"), (snapshot) => setHydrated((old) => ({ ...old, runtime: snapshot.val() }))); const input = onValue(ref(database, "live/scriptedInput"), (snapshot) => setHydrated((old) => ({ ...old, input: snapshot.val() }))); const report = onValue(ref(database, "live/scriptedReport"), (snapshot) => setHydrated((old) => ({ ...old, report: snapshot.val() }))); return () => { runtime(); input(); report(); }; }, [options.live?.revision, options.live?.currentVersionId]);
  useEffect(() => { setFailedCommand(null); }, [options.live?.revision, options.live?.currentVersionId, options.desiredPageId]);
  const latest = useRef<Latest>({ ...options, groups: descriptors, hydrated }); latest.current = { ...options, groups: descriptors, hydrated };
  const setPortValue = useCallback((slot: number, portIndex: number, value: boolean | number) => { const current = latest.current; const found = find(current, slot, portIndex); const runtime = found && runtimeFor(current, found.group); if (!safe(current) || !found || !runtime || (found.descriptor.direction !== "input" && found.descriptor.direction !== "input-output") || !valid(found.descriptor, value) || current.live === null || current.desiredPageId === null || current.playerStatus?.kind !== "ready") return; const database = getRealtimeDatabaseOrNull(); const command = { activationRevision: current.live.revision, currentVersionId: current.live.currentVersionId, pageId: current.desiredPageId, scriptedSlot: found.group.scriptedSlot, elementId: found.group.elementId, portIndex: found.descriptor.portIndex, portId: found.descriptor.portId, targetBootId: runtime.bootId, targetMountRevision: runtime.mountRevision, value }; setFailedCommand(null); if (!database) { setFailedCommand(command); return; } void writeScriptedInput(database, command).catch(() => { if (commandMatchesCurrentContext(command, latest.current)) setFailedCommand(command); }); }, []);
  const current = latest.current; return { groups: descriptors.map((group) => ({ ...group, ports: group.ports.map((port) => viewPort(current, group, port)) })), controlsEnabled: safe(current), sendFailed: failedCommand !== null && commandMatchesCurrentContext(failedCommand, current), setPortValue };
}
