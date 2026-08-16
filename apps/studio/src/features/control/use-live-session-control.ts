"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { writeSlideCommand } from "./control-command-writer";
import { subscribeSlideAck } from "./slide-ack";
import { subscribeLiveCurrent, type LiveState } from "./live-current";
import { LiveControl, type LiveControlView } from "./live-control";

export interface UseLiveSessionControlResult {
  liveState: LiveState;
  view: LiveControlView | null;
  sendFailed: boolean;
  previous(): void;
  next(): void;
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
  const controlRef = useRef<LiveControl | null>(null);

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
    const control = new LiveControl({
      activationRevision,
      writeCommand: (slideIndex) =>
        writeSlideCommand(db, activationRevision, slideIndex),
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

  return { liveState, view, sendFailed, previous, next };
}
