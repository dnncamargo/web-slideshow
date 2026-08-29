"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { QRCodeSVG } from "qrcode.react";

import {
  subscribeLiveCurrent,
  type LiveState,
} from "@/features/live/live-current-read";
import { resolvePublicPlayerUrl } from "@/features/public-player/public-player-url";

import styles from "./page.module.css";
import { clampWatchQrPosition, type WatchQrPosition } from "./watch-qr-position";

const QR_SAFE_INSET = 12;

export default function Home() {
  const player = resolvePublicPlayerUrl();
  const demoUrl = player.baseUrl === null ? null : `${player.baseUrl}/demo`;
  const watchUrl = player.baseUrl === null ? null : `${player.baseUrl}/watch`;
  const coverUrl = player.baseUrl === null ? null : `${player.baseUrl}/cover`;
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const [qrPosition, setQrPosition] = useState<WatchQrPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const qrRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: WatchQrPosition;
  } | null>(null);
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

  useEffect(() => {
    const clampOnResize = () => {
      const element = qrRef.current;
      if (element === null || qrPosition === null) return;
      const rect = element.getBoundingClientRect();
      setQrPosition(clampWatchQrPosition(qrPosition, {
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        inset: QR_SAFE_INSET,
      }));
    };
    window.addEventListener("resize", clampOnResize);
    return () => window.removeEventListener("resize", clampOnResize);
  }, [qrPosition]);

  useEffect(() => {
    if (isLive) return;
    dragRef.current = null;
    setDragging(false);
    setQrPosition(null);
  }, [isLive]);

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    if (dragRef.current !== null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: rect.left, y: rect.top },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setQrPosition({ x: rect.left, y: rect.top });
    setDragging(true);
  }

  function finishDrag(event: PointerEvent<HTMLElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>): void {
    const drag = dragRef.current;
    const element = qrRef.current;
    if (drag?.pointerId !== event.pointerId || element === null) return;
    const rect = element.getBoundingClientRect();
    setQrPosition(clampWatchQrPosition({
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    }, {
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      inset: QR_SAFE_INSET,
    }));
  }

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
            <aside
              ref={qrRef}
              className={`${styles.watchQr} ${dragging ? styles.dragging : ""}`}
              aria-label="Watch live presentation"
              style={qrPosition === null ? undefined : {
                left: `${qrPosition.x}px`,
                top: `${qrPosition.y}px`,
                bottom: "auto",
                transform: "none",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
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
