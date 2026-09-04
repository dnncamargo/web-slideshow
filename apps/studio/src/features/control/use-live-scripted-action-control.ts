"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type Presentation,
  visitSlideElements,
} from "@powershow/document-schema";

import { writeScriptedAction } from "./control-command-writer";
import type { LiveCurrent } from "./live-current";
import type { PlayerOperationalStatus } from "./player-presence";
import { getRealtimeDatabaseOrNull } from "./realtime-db";

export interface ControlScriptedAction {
  portIndex: number;
  portId: string;
  label: string;
}

export interface ControlScriptedActionGroup {
  scriptedSlot: number;
  elementId: string;
  title: string;
  actions: readonly ControlScriptedAction[];
}

export interface UseLiveScriptedActionControlOptions {
  live: LiveCurrent | null;
  livePresentation: Presentation | null;
  desiredPageId: string | null;
  actualPageId: string | null;
  controlSynced: boolean;
  playerStatus: PlayerOperationalStatus | null;
  controlsBlocked: boolean;
}

export interface UseLiveScriptedActionControlResult {
  groups: readonly ControlScriptedActionGroup[];
  actionsEnabled: boolean;
  sendFailed: boolean;
  triggerAction(scriptedSlot: number, portIndex: number): void;
}

interface LatestState extends UseLiveScriptedActionControlOptions {
  groups: readonly ControlScriptedActionGroup[];
}

interface ActionCommandContext {
  activationRevision: number;
  currentVersionId: string;
  pageId: string;
  scriptedSlot: number;
  elementId: string;
  portIndex: number;
  portId: string;
  targetBootId: string;
}

function discoverScriptedActionGroups(
  presentation: Presentation | null,
  desiredPageId: string | null,
): ControlScriptedActionGroup[] {
  if (presentation === null || desiredPageId === null) return [];

  const slide = presentation.slides.find((candidate) => candidate.id === desiredPageId);
  if (slide === undefined) return [];

  const groups: ControlScriptedActionGroup[] = [];
  let scriptedSlot = 0;
  visitSlideElements(slide, (element) => {
    if (element.type !== "scripted") return;

    const actions = element.ports.flatMap((port, portIndex) =>
      port.kind === "action"
        ? [{ portIndex, portId: port.id, label: port.label }]
        : [],
    );
    if (actions.length > 0) {
      groups.push({
        scriptedSlot,
        elementId: element.id,
        title: element.title,
        actions,
      });
    }
    scriptedSlot += 1;
  });
  return groups;
}

function canSendAction(current: LatestState): boolean {
  return current.live !== null &&
    current.desiredPageId !== null &&
    current.actualPageId === current.desiredPageId &&
    current.controlSynced &&
    !current.controlsBlocked &&
    current.playerStatus?.kind === "ready";
}

function findAction(
  groups: readonly ControlScriptedActionGroup[],
  scriptedSlot: number,
  portIndex: number,
): { group: ControlScriptedActionGroup; action: ControlScriptedAction } | null {
  const group = groups.find((candidate) => candidate.scriptedSlot === scriptedSlot);
  const action = group?.actions.find((candidate) => candidate.portIndex === portIndex);
  return group !== undefined && action !== undefined ? { group, action } : null;
}

function commandMatchesCurrentContext(
  command: ActionCommandContext,
  current: LatestState,
): boolean {
  const descriptor = findAction(current.groups, command.scriptedSlot, command.portIndex);
  return descriptor !== null &&
    descriptor.group.elementId === command.elementId &&
    descriptor.action.portId === command.portId &&
    current.live?.revision === command.activationRevision &&
    current.live?.currentVersionId === command.currentVersionId &&
    current.desiredPageId === command.pageId;
}

/** Owns best-effort Control-side Scripted action occurrences for the active slide. */
export function useLiveScriptedActionControl(
  options: UseLiveScriptedActionControlOptions,
): UseLiveScriptedActionControlResult {
  const groups = useMemo(
    () => discoverScriptedActionGroups(options.livePresentation, options.desiredPageId),
    [options.livePresentation, options.desiredPageId],
  );
  const [sendFailed, setSendFailed] = useState(false);
  const latestRef = useRef<LatestState>({ ...options, groups });
  latestRef.current = { ...options, groups };

  useEffect(() => {
    setSendFailed(false);
  }, [options.live?.revision, options.live?.currentVersionId, options.desiredPageId]);

  const triggerAction = useCallback((scriptedSlot: number, portIndex: number) => {
    const current = latestRef.current;
    const descriptor = findAction(current.groups, scriptedSlot, portIndex);
    if (!canSendAction(current) || descriptor === null || current.live === null ||
      current.desiredPageId === null || current.playerStatus?.kind !== "ready") return;

    const database = getRealtimeDatabaseOrNull();
    setSendFailed(false);
    if (database === null) {
      setSendFailed(true);
      return;
    }

    const command: ActionCommandContext = {
      activationRevision: current.live.revision,
      currentVersionId: current.live.currentVersionId,
      pageId: current.desiredPageId,
      scriptedSlot: descriptor.group.scriptedSlot,
      elementId: descriptor.group.elementId,
      portIndex: descriptor.action.portIndex,
      portId: descriptor.action.portId,
      targetBootId: current.playerStatus.presence.bootId,
    };

    void writeScriptedAction(database, command).catch((_error: unknown) => {
      console.error("Control: could not write Scripted action");
      if (commandMatchesCurrentContext(command, latestRef.current)) {
        setSendFailed(true);
      }
    });
  }, []);

  return { groups, actionsEnabled: canSendAction(latestRef.current), sendFailed, triggerAction };
}
