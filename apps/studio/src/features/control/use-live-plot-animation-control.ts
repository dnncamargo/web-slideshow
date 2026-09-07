"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ContentSlot,
  PowerShowElement,
  Presentation,
  TopicsElement,
} from "@powershow/document-schema";

import { writePlotAnimationAction } from "./control-command-writer";
import type { LiveCurrent } from "./live-current";
import type { PlayerOperationalStatus } from "./player-presence";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import type { PlotAnimationAction } from "../live/plot-animation-action";

export interface LivePlotAnimationTarget {
  plotSlot: number;
  elementId: string;
  label: string;
  sourceExcerpt?: string;
}

export interface UseLivePlotAnimationControlOptions {
  database?: ReturnType<typeof getRealtimeDatabaseOrNull>;
  desiredPageId: string | null;
  actualPageId: string | null;
  controlSynced: boolean;
  controlsBlocked: boolean;
  live: LiveCurrent | null;
  livePresentation: Presentation | null;
  playerStatus: PlayerOperationalStatus | null;
}

export interface UseLivePlotAnimationControlResult {
  plotTargets: readonly LivePlotAnimationTarget[];
  actionsEnabled: boolean;
  pendingPlotSlots: ReadonlySet<number>;
  sendFailed: boolean;
  triggerAction(target: LivePlotAnimationTarget, action: PlotAnimationAction): void;
  triggerAll(action: PlotAnimationAction): void;
}

interface CommandContext {
  activationRevision: number;
  currentVersionId: string;
  pageId: string;
  targetBootId: string;
  plotSlot: number;
  elementId: string;
}

interface LatestState {
  options: UseLivePlotAnimationControlOptions;
  targets: readonly LivePlotAnimationTarget[];
}

function normalizeSource(source: string): string {
  return source.trim().replace(/\s+/g, " ");
}

function sourceExcerpt(source: string): string | undefined {
  const normalized = normalizeSource(source);
  return normalized === "" ? undefined : normalized;
}

function visitContentSlot(slot: ContentSlot, visit: (element: PowerShowElement) => void): void {
  slot.children.forEach((element) => visitElement(element, visit));
}

function visitElement(element: PowerShowElement, visit: (element: PowerShowElement) => void): void {
  visit(element);
  if (element.type === "container") {
    element.children.forEach((child) => visitElement(child, visit));
  } else if (element.type === "table" && element.mode === "structured") {
    element.columns.forEach((column) => visitContentSlot(column.header, visit));
    element.rows.forEach((row) => row.cells.forEach((cell) => visitContentSlot(cell, visit)));
  } else if (element.type === "topics") {
    visitTopicItems(element, visit);
  }
}

function visitTopicItems(element: TopicsElement, visit: (element: PowerShowElement) => void): void {
  function visitItems(items: TopicsElement["items"]): void {
    items.forEach((item) => {
      visitContentSlot(item.content, visit);
      visitItems(item.children);
    });
  }
  visitItems(element.items);
}

export function discoverLivePlotAnimationTargets(
  presentation: Presentation | null,
  desiredPageId: string | null,
): LivePlotAnimationTarget[] {
  if (presentation === null || desiredPageId === null) return [];
  const slide = presentation.slides.find((candidate) => candidate.id === desiredPageId);
  if (slide === undefined) return [];
  const targets: LivePlotAnimationTarget[] = [];
  const visit = (element: PowerShowElement): void => {
    if (element.type !== "plot" || element.animation === undefined) return;
    const source = sourceExcerpt(element.source);
    targets.push({
      plotSlot: targets.length,
      elementId: element.id,
      label: source === undefined ? `Plot ${targets.length + 1}` : `Plot ${targets.length + 1} · ${source}`,
      ...(source === undefined ? {} : { sourceExcerpt: source }),
    });
  };
  slide.elements.forEach((element) => visitElement(element, visit));
  return targets;
}

function canSend(options: UseLivePlotAnimationControlOptions): boolean {
  const presence = options.playerStatus?.kind === "ready" ? options.playerStatus.presence : null;
  return options.live !== null &&
    options.desiredPageId !== null &&
    options.actualPageId === options.desiredPageId &&
    options.controlSynced &&
    !options.controlsBlocked &&
    presence !== null &&
    presence.activationRevision === options.live.revision &&
    presence.currentVersionId === options.live.currentVersionId &&
    presence.bootId.trim() !== "";
}

function sameContext(command: CommandContext, current: LatestState): boolean {
  const target = current.targets.find((candidate) => candidate.plotSlot === command.plotSlot);
  const presence = current.options.playerStatus?.kind === "ready" ? current.options.playerStatus.presence : null;
  return target?.elementId === command.elementId &&
    current.options.live?.revision === command.activationRevision &&
    current.options.live?.currentVersionId === command.currentVersionId &&
    current.options.desiredPageId === command.pageId &&
    presence?.bootId === command.targetBootId;
}

function pendingForCurrentContext(pending: ReadonlyMap<number, CommandContext>, current: LatestState): ReadonlySet<number> {
  const result = new Set<number>();
  for (const [slot, command] of pending) if (sameContext(command, current)) result.add(slot);
  return result;
}

export function useLivePlotAnimationControl(
  options: UseLivePlotAnimationControlOptions,
): UseLivePlotAnimationControlResult {
  const plotTargets = useMemo(
    () => discoverLivePlotAnimationTargets(options.livePresentation, options.desiredPageId),
    [options.livePresentation, options.desiredPageId],
  );
  const [pending, setPending] = useState<Map<number, CommandContext>>(() => new Map());
  const pendingRef = useRef<Map<number, CommandContext>>(new Map());
  const [sendFailed, setSendFailed] = useState(false);
  const latestRef = useRef<LatestState>({ options, targets: plotTargets });
  latestRef.current = { options, targets: plotTargets };
  const pendingPlotSlots = useMemo(
    () => pendingForCurrentContext(pending, latestRef.current),
    [pending, options.live?.revision, options.live?.currentVersionId, options.desiredPageId, options.playerStatus],
  );
  const actionsEnabled = canSend(options);

  useEffect(() => {
    pendingRef.current = new Map();
    setPending(new Map());
    setSendFailed(false);
  }, [options.live?.revision, options.live?.currentVersionId, options.desiredPageId, options.playerStatus?.kind === "ready" ? options.playerStatus.presence.bootId : null]);

  const send = useCallback((targets: readonly LivePlotAnimationTarget[], action: PlotAnimationAction) => {
    const current = latestRef.current;
    if (targets.length === 0) return;
    if (!canSend(current.options) || current.options.live === null || current.options.desiredPageId === null) return;
    const database = current.options.database ?? getRealtimeDatabaseOrNull();
    if (database === null) {
      if (database === null) setSendFailed(true);
      return;
    }
    const presence = current.options.playerStatus;
    if (presence?.kind !== "ready") return;
    const commands = targets.map((target) => ({
      activationRevision: current.options.live!.revision,
      currentVersionId: current.options.live!.currentVersionId,
      pageId: current.options.desiredPageId!,
      targetBootId: presence.presence.bootId,
      plotSlot: target.plotSlot,
      elementId: target.elementId,
    }));
    const available = commands.filter((command) => !pendingForCurrentContext(pendingRef.current, current).has(command.plotSlot));
    if (available.length === 0) return;
    setSendFailed(false);
    pendingRef.current = new Map(pendingRef.current);
    available.forEach((command) => pendingRef.current.set(command.plotSlot, command));
    setPending((previous) => {
      const next = new Map(previous);
      available.forEach((command) => next.set(command.plotSlot, command));
      return next;
    });
    const writes = available.map((command) => writePlotAnimationAction(database, { ...command, action }));
    void Promise.allSettled(writes).then((results) => {
      if (!results.every((result) => result.status === "fulfilled") && sameContext(available[0]!, latestRef.current)) setSendFailed(true);
      if (sameContext(available[0]!, latestRef.current)) {
        pendingRef.current = new Map(pendingRef.current);
        available.forEach((command) => pendingRef.current.delete(command.plotSlot));
        setPending((previous) => {
          const next = new Map(previous);
          available.forEach((command) => next.delete(command.plotSlot));
          return next;
        });
      }
    });
  }, []);

  const triggerAction = useCallback((target: LivePlotAnimationTarget, action: PlotAnimationAction) => {
    send([target], action);
  }, [send]);
  const triggerAll = useCallback((action: PlotAnimationAction) => {
    if (pendingForCurrentContext(pendingRef.current, latestRef.current).size > 0) return;
    send(latestRef.current.targets, action);
  }, [pendingPlotSlots, send]);

  return { plotTargets, actionsEnabled, pendingPlotSlots, sendFailed, triggerAction, triggerAll };
}
