"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ContentSlot,
  MaterializedSlide,
  PresentationElement,
  TopicsElement,
} from "@web-slideshow/document-schema";

import { writeShapeAnimationAction } from "./control-command-writer";
import type { LiveCurrent } from "./live-current";
import type { PlayerOperationalStatus } from "./player-presence";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import type { ShapeAnimationAction } from "../live/shape-animation-action";

export interface LiveShapeAnimationTarget {
  shapeSlot: number;
  elementId: string;
  label: string;
}

export interface UseLiveShapeAnimationControlOptions {
  database?: ReturnType<typeof getRealtimeDatabaseOrNull>;
  desiredPageId: string | null;
  actualPageId: string | null;
  controlSynced: boolean;
  controlsBlocked: boolean;
  live: LiveCurrent | null;
  effectiveSlide: MaterializedSlide | null;
  playerStatus: PlayerOperationalStatus | null;
}

export interface UseLiveShapeAnimationControlResult {
  shapeTargets: readonly LiveShapeAnimationTarget[];
  actionsEnabled: boolean;
  pendingShapeSlots: ReadonlySet<number>;
  sendFailed: boolean;
  triggerAction(target: LiveShapeAnimationTarget, action: ShapeAnimationAction): void;
  triggerAll(action: ShapeAnimationAction): void;
}

interface CommandContext {
  activationRevision: number;
  currentVersionId: string;
  pageId: string;
  targetBootId: string;
  shapeSlot: number;
  elementId: string;
}

interface LatestState {
  options: UseLiveShapeAnimationControlOptions;
  targets: readonly LiveShapeAnimationTarget[];
}

function visitContentSlot(slot: ContentSlot, visit: (element: PresentationElement) => void): void {
  slot.children.forEach((element) => visitElement(element, visit));
}

function visitElement(element: PresentationElement, visit: (element: PresentationElement) => void): void {
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

function visitTopicItems(element: TopicsElement, visit: (element: PresentationElement) => void): void {
  function visitItems(items: TopicsElement["items"]): void {
    items.forEach((item) => {
      visitContentSlot(item.content, visit);
      visitItems(item.children);
    });
  }
  visitItems(element.items);
}

export function discoverLiveShapeAnimationTargets(
  effectiveSlide: MaterializedSlide | null,
): LiveShapeAnimationTarget[] {
  if (effectiveSlide === null) return [];
  const targets: LiveShapeAnimationTarget[] = [];
  const visit = (element: PresentationElement): void => {
    if (element.type !== "shape" || element.animation === undefined) return;
    targets.push({ shapeSlot: targets.length, elementId: element.id, label: `Shape ${targets.length + 1}` });
  };
  effectiveSlide.elements.forEach((element) => visitElement(element, visit));
  return targets;
}

function canSend(options: UseLiveShapeAnimationControlOptions): boolean {
  const presence = options.playerStatus?.kind === "ready" ? options.playerStatus.presence : null;
  return options.live !== null && options.desiredPageId !== null &&
    options.actualPageId === options.desiredPageId && options.controlSynced &&
    !options.controlsBlocked && presence !== null &&
    presence.activationRevision === options.live.revision &&
    presence.currentVersionId === options.live.currentVersionId &&
    presence.bootId.trim() !== "";
}

function sameContext(command: CommandContext, current: LatestState): boolean {
  const target = current.targets.find((candidate) => candidate.shapeSlot === command.shapeSlot);
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

export function useLiveShapeAnimationControl(
  options: UseLiveShapeAnimationControlOptions,
): UseLiveShapeAnimationControlResult {
  const shapeTargets = useMemo(() => discoverLiveShapeAnimationTargets(options.effectiveSlide), [options.effectiveSlide]);
  const [pending, setPending] = useState<Map<number, CommandContext>>(() => new Map());
  const pendingRef = useRef<Map<number, CommandContext>>(new Map());
  const [sendFailed, setSendFailed] = useState(false);
  const latestRef = useRef<LatestState>({ options, targets: shapeTargets });
  latestRef.current = { options, targets: shapeTargets };
  const pendingShapeSlots = useMemo(
    () => pendingForCurrentContext(pending, latestRef.current),
    [pending, options.live?.revision, options.live?.currentVersionId, options.desiredPageId, options.playerStatus],
  );
  const actionsEnabled = canSend(options);

  useEffect(() => {
    pendingRef.current = new Map();
    setPending(new Map());
    setSendFailed(false);
  }, [options.live?.revision, options.live?.currentVersionId, options.desiredPageId, options.playerStatus?.kind === "ready" ? options.playerStatus.presence.bootId : null]);

  const send = useCallback((targets: readonly LiveShapeAnimationTarget[], action: ShapeAnimationAction) => {
    const current = latestRef.current;
    if (targets.length === 0 || !canSend(current.options) || current.options.live === null || current.options.desiredPageId === null) return;
    const database = current.options.database ?? getRealtimeDatabaseOrNull();
    if (database === null) { setSendFailed(true); return; }
    const presence = current.options.playerStatus;
    if (presence?.kind !== "ready") return;
    const commands = targets.map((target) => ({
      activationRevision: current.options.live!.revision,
      currentVersionId: current.options.live!.currentVersionId,
      pageId: current.options.desiredPageId!,
      targetBootId: presence.presence.bootId,
      shapeSlot: target.shapeSlot,
      elementId: target.elementId,
    }));
    const available = commands.filter((command) => !pendingForCurrentContext(pendingRef.current, current).has(command.shapeSlot));
    if (available.length === 0) return;
    setSendFailed(false);
    pendingRef.current = new Map(pendingRef.current);
    available.forEach((command) => pendingRef.current.set(command.shapeSlot, command));
    setPending((previous) => {
      const next = new Map(previous);
      available.forEach((command) => next.set(command.shapeSlot, command));
      return next;
    });
    const writes = available.map((command) => writeShapeAnimationAction(database, { ...command, action }));
    void Promise.allSettled(writes).then((results) => {
      if (!results.every((result) => result.status === "fulfilled") && sameContext(available[0]!, latestRef.current)) setSendFailed(true);
      if (sameContext(available[0]!, latestRef.current)) {
        pendingRef.current = new Map(pendingRef.current);
        available.forEach((command) => pendingRef.current.delete(command.shapeSlot));
        setPending((previous) => {
          const next = new Map(previous);
          available.forEach((command) => next.delete(command.shapeSlot));
          return next;
        });
      }
    });
  }, []);

  const triggerAction = useCallback((target: LiveShapeAnimationTarget, action: ShapeAnimationAction) => send([target], action), [send]);
  const triggerAll = useCallback((action: ShapeAnimationAction) => {
    if (pendingForCurrentContext(pendingRef.current, latestRef.current).size > 0) return;
    send(latestRef.current.targets, action);
  }, [send]);

  return { shapeTargets, actionsEnabled, pendingShapeSlots, sendFailed, triggerAction, triggerAll };
}
