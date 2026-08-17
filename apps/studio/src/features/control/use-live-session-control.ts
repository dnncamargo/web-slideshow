"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { writeSlideCommand } from "./control-command-writer";
import { subscribeSlideAck } from "./slide-ack";
import {
  promoteLivePresentationVersion,
  subscribeLiveCurrent,
  type LiveCurrent,
  type LiveState,
} from "./live-current";
import { LiveControl, type LiveControlView } from "./live-control";

export interface UseLiveSessionControlResult {
  liveState: LiveState;
  view: LiveControlView | null;
  sendFailed: boolean;
  promotingVersionId: string | null;
  failedPromotionVersionId: string | null;
  previous(): void;
  next(): void;
  updatePlayer(targetVersionId: string): void;
}

interface PromotionAttempt {
  source: LiveCurrent;
  targetVersionId: string;
  status: "pending" | "failed";
}

function sameLiveIdentity(a: LiveCurrent, b: LiveCurrent): boolean {
  return (
    a.publicationId === b.publicationId &&
    a.currentVersionId === b.currentVersionId &&
    a.revision === b.revision
  );
}

/**
 * Owns the Studio Control live session lifecycle.
 *
 * Subscribes to the active presentation, creates/destroys the activation-scoped
 * LiveControl, subscribes to the Player slide ACK stream, and wires the slide
 * command writer. Exposes the ACK-authoritative view and the Previous/Next
 * actions without leaking the LiveControl instance, the database handle, or
 * ACK internals.
 */
export function useLiveSessionControl(): UseLiveSessionControlResult {
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const [view, setView] = useState<LiveControlView | null>(null);
  const [sendFailed, setSendFailed] = useState(false);
  const [promotionAttempt, setPromotionAttempt] =
    useState<PromotionAttempt | null>(null);
  const controlRef = useRef<LiveControl | null>(null);
  const promotionTokenRef = useRef(0);

  useEffect(() => {
    const unsub = subscribeLiveCurrent((nextState) => {
      setLiveState(nextState);

      if (nextState.kind !== "active") {
        setView(null);
      }
    });

    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (liveState.kind !== "active") {
      controlRef.current?.destroy();
      controlRef.current = null;
      return;
    }

    const db = getRealtimeDatabaseOrNull();
    if (!db) {
      return;
    }

    const activationRevision = liveState.live.revision;
    const currentVersionId = liveState.live.currentVersionId;
    const control = new LiveControl({
      activationRevision,
      currentVersionId,
      writeCommand: (slideIndex) =>
        writeSlideCommand(
          db,
          activationRevision,
          currentVersionId,
          slideIndex,
        ),
      now: () => performance.now(),
      schedule: (callback, delay) => {
        const id = window.setTimeout(callback, delay);
        return () => window.clearTimeout(id);
      },
      onViewChange: setView,
      onCommandError: () => setSendFailed(true),
    });

    controlRef.current = control;

    const unsubAck = subscribeSlideAck((ack) => control.handleAck(ack));

    return () => {
      unsubAck?.();
      control.destroy();
      controlRef.current = null;
    };
  }, [liveState]);

  const previous = useCallback(() => {
    const control = controlRef.current;
    if (!control) return;
    setSendFailed(false);
    control.previous();
  }, []);

  const next = useCallback(() => {
    const control = controlRef.current;
    if (!control) return;
    setSendFailed(false);
    control.next();
  }, []);

  const updatePlayer = useCallback(
    (targetVersionId: string) => {
      if (liveState.kind !== "active") return;

      const source = liveState.live;
      const target = targetVersionId.trim();
      if (target === "" || target === source.currentVersionId) return;

      const token = ++promotionTokenRef.current;
      setPromotionAttempt({ source, targetVersionId: target, status: "pending" });

      void promoteLivePresentationVersion(source, target).catch(() => {
        if (promotionTokenRef.current === token) {
          setPromotionAttempt({
            source,
            targetVersionId: target,
            status: "failed",
          });
        }
      });
    },
    [liveState],
  );

  const attemptMatchesLive =
    promotionAttempt !== null &&
    liveState.kind === "active" &&
    sameLiveIdentity(promotionAttempt.source, liveState.live);

  return {
    liveState,
    view,
    sendFailed,
    promotingVersionId:
      attemptMatchesLive && promotionAttempt.status === "pending"
        ? promotionAttempt.targetVersionId
        : null,
    failedPromotionVersionId:
      attemptMatchesLive && promotionAttempt.status === "failed"
        ? promotionAttempt.targetVersionId
        : null,
    previous,
    next,
    updatePlayer,
  };
}
