"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { displayName } from "@web-slideshow/instance-branding";

import {
  subscribeLiveCurrentForOwner,
  type LiveState,
} from "@/features/live/live-current-read";
import { readPublishedOwnerUid } from "@/features/persistence/firestore-published-presentation-reader";
import { resolvePublicPlayerUrl } from "@/features/public-player/public-player-url";

import styles from "./page.module.css";
import { clampWatchQrPosition, type WatchQrPosition } from "./watch-qr-position";

const QR_SAFE_INSET = 12;

export default function Home() {
  const [requestedPublicationId, setRequestedPublicationId] = useState<string | null>(null);
  useEffect(() => {
    setRequestedPublicationId(new URLSearchParams(window.location.search).get("publication")?.trim() || null);
  }, []);
  const player = resolvePublicPlayerUrl();
  const demoUrl = player.baseUrl === null ? null : `${player.baseUrl}/demo`;
  const publicQuery = requestedPublicationId === null ? "" : `?publication=${encodeURIComponent(requestedPublicationId)}`;
  const watchUrl = player.baseUrl === null ? null : `${player.baseUrl}/watch${publicQuery}`;
  const coverUrl = player.baseUrl === null ? null : `${player.baseUrl}/cover${publicQuery}`;
  const [liveState, setLiveState] = useState<LiveState>(
    requestedPublicationId === null ? { kind: "none" } : { kind: "loading" },
  );
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
    if (requestedPublicationId === null) {
      setLiveState({ kind: "none" });
      return () => { active = false; };
    }

    let unsubscribe: (() => void) | null = null;
    void readPublishedOwnerUid(requestedPublicationId).then((ownerUid) => {
      if (!active) return;
      if (ownerUid === null) {
        setLiveState({ kind: "none" });
        return;
      }
      unsubscribe = subscribeLiveCurrentForOwner(ownerUid, (nextState) => {
        if (!active) return;
        if (nextState.kind === "active" && nextState.live.publicationId !== requestedPublicationId) {
          setLiveState({ kind: "none" });
          return;
        }
        setLiveState(nextState);
      });
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [requestedPublicationId]);

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
            title={isLive ? `${displayName} live presentation cover` : `${displayName} demo presentation`}
            tabIndex={-1}
          />
        )}
      </div>
      <div className={styles.overlay} aria-hidden="true" />

      <main className={styles.main}>
        <h1 className={styles.brand}>{displayName}</h1>

        <div className={styles.rail}>
          {isLive && coverUrl !== null && watchUrl !== null ? (
            <aside
              ref={qrRef}
              className={`${styles.watchQr} ${dragging ? styles.dragging : ""}`}
              aria-label="Watch live presentation"
              style={qrPosition === null ? undefined : {
                position: "fixed",
                left: `${qrPosition.x}px`,
                top: `${qrPosition.y}px`,
                bottom: "auto",
                transform: "none",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onLostPointerCapture={finishDrag}
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

      <footer className={styles.metaLinks}>
        <a href="/docs">Docs</a>
        <a
          href="https://github.com/dnncamargo/web-slideshow"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
