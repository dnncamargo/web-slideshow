"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";

import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { requestPlayerReload } from "./player-recovery-request";
import { subscribeLiveCurrent, type LiveState } from "../live/live-current-read";
import { PLAYER_PRESENCE_PATH, parsePlayerPresence, resolvePlayerOperationalStatus, type PlayerOperationalStatus } from "./player-presence";
import { buildControlStatePath, buildPlayerStatePath, parseLiveControlState, parseLivePlayerState, type LiveControlState, type LivePlayerState } from "../live/live-state";

import styles from "./maintenance-page.module.css";

function label(status: PlayerOperationalStatus | null): string {
  if (status === null || status.kind === "no-report") return "No Player report";
  if (status.kind === "starting") return "Player starting…";
  if (status.kind === "ready") return "Player ready";
  if (status.kind === "load-failed") return "Player load failed";
  return "Player disconnected";
}

export function MaintenancePage() {
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const [status, setStatus] = useState<PlayerOperationalStatus | null>(null);
  const [controlState, setControlState] = useState<LiveControlState | null>(null);
  const [playerState, setPlayerState] = useState<LivePlayerState | null>(null);
  const [reloadPendingBootId, setReloadPendingBootId] = useState<string | null>(null);
  const [reloadWriting, setReloadWriting] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);

  useEffect(() => subscribeLiveCurrent(setLiveState) ?? undefined, []);
  useEffect(() => {
    setReloadPendingBootId(null);
    setReloadError(null);
  }, [liveState.kind === "active" ? `${liveState.live.revision}:${liveState.live.currentVersionId}` : liveState.kind]);
  useEffect(() => {
    if (liveState.kind !== "active") { setStatus(null); setControlState(null); setPlayerState(null); return; }
    const db = getRealtimeDatabaseOrNull();
    if (!db) return;
    const unsubs = [
      onValue(ref(db, PLAYER_PRESENCE_PATH), (snapshot) => setStatus(resolvePlayerOperationalStatus(liveState.live, parsePlayerPresence(snapshot.val())))),
      onValue(ref(db, buildControlStatePath()), (snapshot) => setControlState(parseLiveControlState(snapshot.val()))),
      onValue(ref(db, buildPlayerStatePath()), (snapshot) => setPlayerState(parseLivePlayerState(snapshot.val()))),
    ];
    return () => { unsubs.forEach((unsubscribe) => unsubscribe()); };
  }, [liveState]);

  const presence = status !== null && status.kind !== "no-report" ? status.presence : null;
  useEffect(() => {
    if (reloadPendingBootId === null || presence === null || presence.bootId === reloadPendingBootId) return;
    if (status?.kind === "ready" || status?.kind === "load-failed") setReloadPendingBootId(null);
  }, [presence, reloadPendingBootId, status]);
  const canReload = liveState.kind === "active" && presence !== null && status?.kind !== "disconnected" && !reloadWriting && reloadPendingBootId === null;
  async function reloadPlayer(): Promise<void> {
    if (!canReload || liveState.kind !== "active" || presence === null) return;
    const db = getRealtimeDatabaseOrNull();
    if (!db) { setReloadError("Player recovery is unavailable."); return; }
    setReloadWriting(true); setReloadError(null);
    try {
      await requestPlayerReload(db, liveState.live.revision, liveState.live.currentVersionId, presence.bootId);
      setReloadPendingBootId(presence.bootId);
    } catch {
      setReloadError("Could not request Player reload. Try again.");
    } finally { setReloadWriting(false); }
  }
  const slideEvidence = liveState.kind === "active" && controlState !== null && playerState !== null && controlState.activationRevision === liveState.live.revision && playerState.activationRevision === liveState.live.revision && controlState.currentVersionId === liveState.live.currentVersionId && playerState.currentVersionId === liveState.live.currentVersionId && controlState.revision === playerState.appliedControlRevision ? "Slide state synced" : "Slide state pending";
  return <main className={styles.page}>
    <header className={styles.header}><Link href={STUDIO_ROUTES.control}>Control</Link><h1>Maintenance &amp; Diagnostics</h1></header>
    <div className={styles.grid}>
      <section className={styles.section} aria-labelledby="player-status"><h2 id="player-status">Player status</h2><p className={styles.primary}>{label(status)}</p>
        <dl><dt>Last transition</dt><dd>{presence ? new Date(presence.transitionedAt).toLocaleString() : "No report"}</dd><dt>Boot stage</dt><dd>{presence?.stage ?? "—"}</dd>{presence?.errorCode && <><dt>Failure code</dt><dd>{presence.errorCode}</dd></>}<dt>Activation/version alignment</dt><dd>{presence ? "Current activation and version" : "No matching report"}</dd><dt>Slide state</dt><dd>{slideEvidence}</dd></dl>
      </section>
      <section className={styles.section} aria-labelledby="recovery"><h2 id="recovery">Recovery</h2><p>{reloadPendingBootId !== null ? "Waiting for Player…" : "Request a remote Player reload."}</p>{reloadError && <p role="alert">{reloadError}</p>}<div className={styles.actions}><button type="button" disabled>Try presentation again</button><button type="button" disabled={!canReload} onClick={() => void reloadPlayer()}>{reloadWriting ? "Requesting reload…" : "Reload Player"}</button><button type="button" disabled>Clear cache and reload</button></div></section>
    </div>
  </main>;
}
