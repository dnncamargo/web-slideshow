"use client";

import { onValue, ref } from "firebase/database";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { ProductSurfaceBrand } from "@/features/app/product-surface-brand";
import {
  resolvePublicPlayerUrl,
  withPlayerLogsEnabled,
} from "@/features/public-player/public-player-url";
import { Topbar, TopbarActions } from "@powershow/ui";
import {
  subscribeLiveCurrent,
  type LiveState,
} from "../live/live-current-read";
import {
  buildControlStatePath,
  buildPlayerStatePath,
  parseLiveControlState,
  parseLivePlayerState,
  type LiveControlState,
  type LivePlayerState,
} from "../live/live-state";
import {
  readControlLatencySnapshot,
  type ControlLatencySnapshot,
} from "./control-latency-snapshot";
import {
  PLAYER_PRESENCE_PATH,
  parsePlayerPresence,
  resolvePlayerOperationalStatus,
  type PlayerOperationalStatus,
} from "./player-presence";
import {
  requestPlayerClearCache,
  requestPlayerReload,
  requestPlayerRetry,
} from "./player-recovery-request";
import { getRealtimeDatabaseOrNull } from "./realtime-db";

import styles from "./maintenance-page.module.css";

function label(status: PlayerOperationalStatus | null): string {
  if (status === null || status.kind === "no-report") {
    return "No Player report";
  }
  if (status.kind === "starting") {
    return "Player starting…";
  }
  if (status.kind === "ready") {
    return "Player ready";
  }
  if (status.kind === "load-failed") {
    return "Player load failed";
  }
  return "Player disconnected";
}

export function MaintenancePage() {
  const publicPlayer = resolvePublicPlayerUrl();
  const playerLogsUrl = publicPlayer.available && publicPlayer.baseUrl
    ? withPlayerLogsEnabled(publicPlayer.baseUrl)
    : null;
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const [status, setStatus] = useState<PlayerOperationalStatus | null>(null);
  const [controlState, setControlState] = useState<LiveControlState | null>(null);
  const [playerState, setPlayerState] = useState<LivePlayerState | null>(null);
  const [latencySnapshot, setLatencySnapshot] =
    useState<ControlLatencySnapshot | null>(null);
  const [reloadPendingBootId, setReloadPendingBootId] = useState<string | null>(
    null,
  );
  const [reloadWriting, setReloadWriting] = useState(false);
  const [clearCacheWriting, setClearCacheWriting] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [retryPending, setRetryPending] = useState<{
    bootId: string;
    sawStarting: boolean;
  } | null>(null);
  const [retryWriting, setRetryWriting] = useState(false);
  const recoveryTokenRef = useRef(0);
  const activePublicationId =
    liveState.kind === "active" ? liveState.live.publicationId : null;
  const activeRevision =
    liveState.kind === "active" ? liveState.live.revision : null;
  const activeVersionId =
    liveState.kind === "active" ? liveState.live.currentVersionId : null;

  useEffect(() => {
    let subscribed = true;
    const unsubscribe = subscribeLiveCurrent((nextState) => {
      if (subscribed) {
        setLiveState(nextState);
      }
    });

    return () => {
      subscribed = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    recoveryTokenRef.current += 1;
    setReloadPendingBootId(null);
    setReloadWriting(false);
    setClearCacheWriting(false);
    setReloadError(null);
    setRetryPending(null);
    setRetryWriting(false);

    if (
      activePublicationId !== null &&
      activeRevision !== null &&
      activeVersionId !== null
    ) {
      setLatencySnapshot(
        readControlLatencySnapshot({
          publicationId: activePublicationId,
          activationRevision: activeRevision,
          currentVersionId: activeVersionId,
        }),
      );
    } else {
      setLatencySnapshot(null);
    }

    return () => {
      recoveryTokenRef.current += 1;
    };
  }, [
    activePublicationId,
    activeRevision,
    activeVersionId,
    liveState.kind,
  ]);

  useEffect(() => {
    if (liveState.kind !== "active") {
      setStatus(null);
      setControlState(null);
      setPlayerState(null);
      return;
    }

    const database = getRealtimeDatabaseOrNull();
    if (!database) {
      setStatus(null);
      setControlState(null);
      setPlayerState(null);
      return;
    }

    setStatus(null);
    setControlState(null);
    setPlayerState(null);

    let subscribed = true;
    const unsubscribes = [
      onValue(ref(database, PLAYER_PRESENCE_PATH), (snapshot) => {
        if (subscribed) {
          setStatus(
            resolvePlayerOperationalStatus(
              liveState.live,
              parsePlayerPresence(snapshot.val()),
            ),
          );
        }
      }),
      onValue(ref(database, buildControlStatePath()), (snapshot) => {
        if (subscribed) {
          setControlState(parseLiveControlState(snapshot.val()));
        }
      }),
      onValue(ref(database, buildPlayerStatePath()), (snapshot) => {
        if (subscribed) {
          setPlayerState(parseLivePlayerState(snapshot.val()));
        }
      }),
    ];

    return () => {
      subscribed = false;
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [liveState]);

  const currentStatus =
    status === null ||
    status.kind === "no-report" ||
    (liveState.kind === "active" &&
      status.presence.activationRevision === liveState.live.revision &&
      status.presence.currentVersionId === liveState.live.currentVersionId)
      ? status
      : null;
  const presence =
    currentStatus !== null && currentStatus.kind !== "no-report"
      ? currentStatus.presence
      : null;

  useEffect(() => {
    if (
      reloadPendingBootId === null ||
      presence === null ||
      presence.bootId === reloadPendingBootId
    ) {
      return;
    }

    if (
      currentStatus?.kind === "ready" ||
      currentStatus?.kind === "load-failed"
    ) {
      setReloadPendingBootId(null);
    }
  }, [currentStatus, presence, reloadPendingBootId]);

  useEffect(() => {
    if (retryPending === null || presence === null) return;
    if (presence.bootId !== retryPending.bootId) {
      return;
    }
    if (!retryPending.sawStarting && presence.stage === "starting") {
      setRetryPending({ ...retryPending, sawStarting: true });
      return;
    }
    if (
      retryPending.sawStarting &&
      (presence.stage === "ready" || presence.stage === "load-failed")
    ) {
      setRetryPending(null);
    }
  }, [presence, retryPending]);

  const canReload =
    liveState.kind === "active" &&
    presence !== null &&
    currentStatus?.kind !== "disconnected" &&
    !reloadWriting &&
    !clearCacheWriting &&
    reloadPendingBootId === null &&
    retryPending === null &&
    !retryWriting;

  const canRetry =
    liveState.kind === "active" &&
    presence !== null &&
    currentStatus?.kind === "load-failed" &&
    currentStatus.presence.bootId === presence.bootId &&
    currentStatus.presence.activationRevision === liveState.live.revision &&
    currentStatus.presence.currentVersionId === liveState.live.currentVersionId &&
    !reloadWriting &&
    !clearCacheWriting &&
    reloadPendingBootId === null &&
    retryWriting === false &&
    retryPending === null;

  const canClearCache =
    liveState.kind === "active" &&
    presence !== null &&
    (currentStatus?.kind === "ready" || currentStatus?.kind === "load-failed") &&
    !reloadWriting &&
    !clearCacheWriting &&
    reloadPendingBootId === null &&
    retryPending === null &&
    !retryWriting;

  async function reloadPlayer(): Promise<void> {
    if (!canReload || liveState.kind !== "active" || presence === null) {
      return;
    }

    const database = getRealtimeDatabaseOrNull();
    if (!database) {
      setReloadError("Player recovery is unavailable.");
      return;
    }

    const attemptToken = ++recoveryTokenRef.current;
    const requestedBootId = presence.bootId;
    setReloadWriting(true);
    setReloadError(null);

    try {
      await requestPlayerReload(
        database,
        liveState.live.revision,
        liveState.live.currentVersionId,
        requestedBootId,
      );

      if (recoveryTokenRef.current === attemptToken) {
        setReloadPendingBootId(requestedBootId);
      }
    } catch {
      if (recoveryTokenRef.current === attemptToken) {
        setReloadError("Could not request Player reload. Try again.");
      }
    } finally {
      if (recoveryTokenRef.current === attemptToken) {
        setReloadWriting(false);
      }
    }
  }

  async function retryPlayer(): Promise<void> {
    if (!canRetry || liveState.kind !== "active" || presence === null) {
      return;
    }

    const database = getRealtimeDatabaseOrNull();
    if (!database) {
      setReloadError("Player recovery is unavailable.");
      return;
    }

    const attemptToken = ++recoveryTokenRef.current;
    const requestedBootId = presence.bootId;
    setRetryWriting(true);
    setReloadError(null);

    try {
      await requestPlayerRetry(
        database,
        liveState.live.revision,
        liveState.live.currentVersionId,
        requestedBootId,
      );
      if (recoveryTokenRef.current === attemptToken) {
        setRetryPending({ bootId: requestedBootId, sawStarting: false });
      }
    } catch {
      if (recoveryTokenRef.current === attemptToken) {
        setReloadError("Could not request Player retry. Try again.");
      }
    } finally {
      if (recoveryTokenRef.current === attemptToken) {
        setRetryWriting(false);
      }
    }
  }

  async function clearCacheAndReload(): Promise<void> {
    if (
      !canClearCache ||
      liveState.kind !== "active" ||
      presence === null ||
      !window.confirm("Clear the Player browser cache and reload?")
    ) {
      return;
    }

    const database = getRealtimeDatabaseOrNull();
    if (!database) {
      setReloadError("Player recovery is unavailable.");
      return;
    }

    const attemptToken = ++recoveryTokenRef.current;
    const requestedBootId = presence.bootId;
    setClearCacheWriting(true);
    setReloadError(null);

    try {
      await requestPlayerClearCache(
        database,
        liveState.live.revision,
        liveState.live.currentVersionId,
        requestedBootId,
      );
      if (recoveryTokenRef.current === attemptToken) {
        setReloadPendingBootId(requestedBootId);
      }
    } catch {
      if (recoveryTokenRef.current === attemptToken) {
        setReloadError("Could not request Player cache clearing. Try again.");
      }
    } finally {
      if (recoveryTokenRef.current === attemptToken) {
        setClearCacheWriting(false);
      }
    }
  }

  const slideEvidence =
    liveState.kind === "active" &&
    controlState !== null &&
    playerState !== null &&
    controlState.activationRevision === liveState.live.revision &&
    playerState.activationRevision === liveState.live.revision &&
    controlState.currentVersionId === liveState.live.currentVersionId &&
    playerState.currentVersionId === liveState.live.currentVersionId &&
    controlState.revision === playerState.appliedControlRevision
      ? "Slide state synced"
      : "Slide state pending";

  return (
    <main className={styles.page}>
      <Topbar className={styles.maintenanceTopbar}>
        <ProductSurfaceBrand surface="control" />
        <TopbarActions>
          <Link className={styles.backLink} href={STUDIO_ROUTES.control}>
            &lt;&lt;&lt; Back to presentation
          </Link>
        </TopbarActions>
      </Topbar>
      <div className={styles.header}>
        <h1>Maintenance &amp; Diagnostics</h1>
      </div>
      <div className={styles.grid}>
        <section className={styles.section} aria-labelledby="player-status">
          <h2 id="player-status">Player status</h2>
          <p className={styles.primary}>{label(currentStatus)}</p>
          <dl>
            <dt>Last transition</dt>
            <dd>
              {presence
                ? new Date(presence.transitionedAt).toLocaleString()
                : "No report"}
            </dd>
            <dt>Boot stage</dt>
            <dd>{presence?.stage ?? "—"}</dd>
            {presence?.errorCode && (
              <>
                <dt>Failure code</dt>
                <dd>{presence.errorCode}</dd>
              </>
            )}
            <dt>Activation/version alignment</dt>
            <dd>
              {presence
                ? "Current activation and version"
                : "No matching report"}
            </dd>
            <dt>Slide state</dt>
            <dd>{slideEvidence}</dd>
            <dt>Last slide latency</dt>
            <dd>
              {latencySnapshot === null
                ? "Not measured in this Control tab"
                : `${Math.round(latencySnapshot.latencyMs)} ms`}
            </dd>
          </dl>
        </section>
        <section className={styles.section} aria-labelledby="recovery">
          <h2 id="recovery">Recovery</h2>
          <p>
            {retryPending !== null
              ? "Trying again…"
              : reloadPendingBootId !== null
              ? "Waiting for Player…"
              : "Request a remote Player reload."}
          </p>
          {reloadError && <p role="alert">{reloadError}</p>}
          <div className={styles.actions}>
            {playerLogsUrl ? (
              <a
                className={styles.actionLink}
                href={playerLogsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Player with logs
              </a>
            ) : (
              <button type="button" disabled>
                Open Player with logs
              </button>
            )}
            <button
              type="button"
              disabled={!canRetry}
              onClick={() => void retryPlayer()}
            >
              {retryWriting ? "Trying again…" : "Try presentation again"}
            </button>
            <button
              type="button"
              disabled={!canReload}
              onClick={() => void reloadPlayer()}
            >
              {reloadWriting ? "Requesting reload…" : "Reload Player"}
            </button>
            <button
              type="button"
              disabled={!canClearCache}
              onClick={() => void clearCacheAndReload()}
            >
              {clearCacheWriting ? "Clearing cache…" : "Clear cache and reload"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
