"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";

import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
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

  useEffect(() => subscribeLiveCurrent(setLiveState) ?? undefined, []);
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
  const slideEvidence = liveState.kind === "active" && controlState !== null && playerState !== null && controlState.activationRevision === liveState.live.revision && playerState.activationRevision === liveState.live.revision && controlState.currentVersionId === liveState.live.currentVersionId && playerState.currentVersionId === liveState.live.currentVersionId && controlState.revision === playerState.appliedControlRevision ? "Slide state synced" : "Slide state pending";
  return <main className={styles.page}>
    <header className={styles.header}><Link href={STUDIO_ROUTES.control}>Control</Link><h1>Maintenance &amp; Diagnostics</h1></header>
    <div className={styles.grid}>
      <section className={styles.section} aria-labelledby="player-status"><h2 id="player-status">Player status</h2><p className={styles.primary}>{label(status)}</p>
        <dl><dt>Last transition</dt><dd>{presence ? new Date(presence.transitionedAt).toLocaleString() : "No report"}</dd><dt>Boot stage</dt><dd>{presence?.stage ?? "—"}</dd>{presence?.errorCode && <><dt>Failure code</dt><dd>{presence.errorCode}</dd></>}<dt>Activation/version alignment</dt><dd>{presence ? "Current activation and version" : "No matching report"}</dd><dt>Slide state</dt><dd>{slideEvidence}</dd></dl>
      </section>
      <section className={styles.section} aria-labelledby="recovery"><h2 id="recovery">Recovery</h2><p>Recovery commands are not implemented in this release.</p><div className={styles.actions}><button type="button" disabled>Try presentation again</button><button type="button" disabled>Reload Player</button><button type="button" disabled>Clear cache and reload</button></div></section>
    </div>
  </main>;
}
