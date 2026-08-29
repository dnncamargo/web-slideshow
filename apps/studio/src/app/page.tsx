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
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const isLive = liveState.kind === "active";
  const presentationUrl = isLive ? watchUrl : demoUrl;

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
            src={presentationUrl}
            title={isLive ? "PowerShow live presentation" : "PowerShow demo presentation"}
            tabIndex={-1}
          />
        )}
      </div>
      <div className={styles.overlay} aria-hidden="true" />

      <main className={styles.main}>
        <h1 className={styles.brand}>PowerShow</h1>

        {isLive && watchUrl !== null ? (
          <aside className={styles.watchQr} aria-label="Watch live presentation">
            <QRCodeSVG value={watchUrl} size={112} level="M" includeMargin />
            <span>Watch live</span>
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
      </main>
    </div>
  );
}
