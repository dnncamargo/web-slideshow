"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { writeControlState as writeLiveControlState } from "./control-command-writer";
import {
  promoteLivePresentationVersion,
  subscribeLiveCurrent,
  type LiveCurrent,
  type LiveState,
} from "./live-current";
import { LiveControl, type LiveControlView } from "./live-control";
import {
  buildControlStatePath,
  buildPlayerStatePath,
  parseLiveControlState,
  parseLivePlayerState,
} from "../live/live-state";

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

export interface UseLiveSessionControlOptions {
  resolvePageId(pageIndex: number): string | null;
  resolvePageIndex(pageId: string): number | null;
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
 * LiveControl, and wires the control/player projection-state streams. Exposes
 * the ACK-authoritative view and the Previous/Next actions without leaking the
 * LiveControl instance, the database handle, or the RTDB listeners.
 */
export function useLiveSessionControl({
  resolvePageId,
  resolvePageIndex,
}: UseLiveSessionControlOptions): UseLiveSessionControlResult {
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
    setView(null);
    let sawControlState = false;
    let sawPlayerState = false;
    let hydrated = false;
    let pendingView: LiveControlView | null = null;

    const flushHydratedView = (): void => {
      if (!hydrated && sawControlState && sawPlayerState) {
        hydrated = true;
        if (pendingView !== null) {
          setView(pendingView);
        }
      }
    };

    const control = new LiveControl({
      activationRevision,
      currentVersionId,
      resolvePageId,
      resolvePageIndex,
      writeControlState: (pageIndex) => {
        const pageId = resolvePageId(pageIndex);

        if (pageId === null) {
          throw new Error("Unable to resolve a pageId for live navigation.");
        }

        return writeLiveControlState(
          db,
          activationRevision,
          currentVersionId,
          pageId,
        );
      },
      now: () => performance.now(),
      schedule: (callback, delay) => {
        const id = window.setTimeout(callback, delay);
        return () => window.clearTimeout(id);
      },
      onViewChange: (nextView) => {
        pendingView = nextView;

        if (hydrated) {
          setView(nextView);
        }
      },
      onCommandError: () => setSendFailed(true),
    });

    controlRef.current = control;

    const controlStateUnsub = onValue(
      ref(db, buildControlStatePath()),
      (snapshot) => {
        const state = parseLiveControlState(snapshot.val());
        sawControlState = true;

        if (
          state !== null &&
          state.activationRevision === activationRevision &&
          state.currentVersionId === currentVersionId
        ) {
          control.handleControlState(state);
        }

        flushHydratedView();
      },
    );

    const playerStateUnsub = onValue(
      ref(db, buildPlayerStatePath()),
      (snapshot) => {
        const state = parseLivePlayerState(snapshot.val());
        sawPlayerState = true;

        if (
          state !== null &&
          state.activationRevision === activationRevision &&
          state.currentVersionId === currentVersionId
        ) {
          control.handlePlayerState(state);
        }

        flushHydratedView();
      },
    );

    return () => {
      controlStateUnsub();
      playerStateUnsub();
      control.destroy();
      controlRef.current = null;
    };
  }, [liveState, resolvePageId, resolvePageIndex]);

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
      setPromotionAttempt({
        source,
        targetVersionId: target,
        status: "pending",
      });

      void promoteLivePresentationVersion(source, target).catch(
        (error: unknown) => {
          console.error("Control: live version promotion failed", error);
          if (promotionTokenRef.current === token) {
            setPromotionAttempt({
              source,
              targetVersionId: target,
              status: "failed",
            });
          }
        },
      );
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
