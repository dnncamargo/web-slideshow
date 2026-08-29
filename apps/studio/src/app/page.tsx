"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import {
  subscribeLiveCurrent,
  type LiveState,
} from "@/features/live/live-current-read";
import { resolvePublicPlayerUrl } from "@/features/public-player/public-player-url";

import styles from "./page.module.css";

export default function Home() {
  const player = resolvePublicPlayerUrl();
  const demoUrl = player.baseUrl === null ? null : `${player.baseUrl}/demo`;
  const watchUrl = player.baseUrl === null ? null : `${player.baseUrl}/watch`;
  const coverUrl = player.baseUrl === null ? null : `${player.baseUrl}/cover`;
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const isLive = liveState.kind === "active";
  const presentationUrl = isLive ? coverUrl : demoUrl;
  const coverKey = isLive
    ? `${liveState.live.publicationId}:${liveState.live.currentVersionId}:${liveState.live.revision}`
    : null;

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeLiveCurrent((nextState) => {
      if (active) setLiveState(nextState);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return (
    <div className={styles.landing}>
      <div className={styles.background}>
        {presentationUrl === null ? (
          <span className={styles.unavailable}>Player unavailable</span>
        ) : (
          <iframe
            className={styles.demo}
            key={isLive ? coverKey : "demo"}
            src={presentationUrl}
            title={isLive ? "PowerShow live presentation cover" : "PowerShow demo presentation"}
            tabIndex={-1}
          />
        )}
      </div>
      <div className={styles.overlay} aria-hidden="true" />

      <main className={styles.main}>
        <h1 className={styles.brand}>PowerShow</h1>

        <div className={styles.rail}>
          {isLive && coverUrl !== null && watchUrl !== null ? (
            <aside className={styles.watchQr} aria-label="Watch live presentation">
              <div className={styles.watchStatus}>
                <span className={styles.liveDot} aria-hidden="true" />
                <span>WATCH LIVE</span>
              </div>
              <QRCodeSVG value={watchUrl} level="M" includeMargin />
            </aside>
          ) : null}
          <div className={styles.actions}>
            <a className={`${styles.action} ${styles.studioAction}`} href="/studio">
              <span>Studio</span>
            </a>

            {player.available && player.baseUrl !== null ? (
              <a className={`${styles.action} ${styles.playerAction}`} href={player.baseUrl}>
                <span>Player</span>
              </a>
            ) : (
              <span className={`${styles.action} ${styles.playerAction}`} aria-disabled="true">
                <span>Player</span>
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
