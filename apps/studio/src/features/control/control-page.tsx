"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { useRouter } from "next/navigation";

import {
  getRealtimeDatabaseOrNull,
  isRealtimeDatabaseConfigured,
} from "./realtime-db";
import { writeSlideCommand } from "./control-command-writer";
import { subscribeSlideAck } from "./slide-ack";
import { subscribeLiveCurrent, type LiveState } from "./live-current";
import { LiveControl, type LiveControlView } from "./live-control";

import styles from "./control-page.module.css";

function describeStatus(
  t: StudioTranslate,
  status: LiveControlView["status"],
): string {
  if (status.kind === "awaiting-player") {
    return t("control.awaitingPlayer");
  }

  if (status.kind === "syncing") {
    return t("control.syncing");
  }

  if (status.latencyMs !== undefined) {
    return `${t("control.synced")} • ${Math.round(status.latencyMs)} ms`;
  }

  return t("control.synced");
}

export function ControlPage() {
  const { t } = useStudioI18n();
  const router = useRouter();
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const [available] = useState(() => isRealtimeDatabaseConfigured());
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<LiveControlView | null>(null);
  const controlRef = useRef<LiveControl | null>(null);

  useEffect(() => {
    const unsub = subscribeLiveCurrent(setLiveState);
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (liveState.kind !== "active") {
      controlRef.current?.destroy();
      controlRef.current = null;
      setView(null);
      return;
    }

    const db = getRealtimeDatabaseOrNull();
    if (!db) {
      setError(t("control.unavailable"));
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
      onCommandError: () => {
        setError(t("control.sendFailed"));
      },
    });

    controlRef.current = control;

    const unsubAck = subscribeSlideAck((ack) => control.handleAck(ack));

    return () => {
      unsubAck?.();
      control.destroy();
      controlRef.current = null;
    };
  }, [liveState, t]);

  const go = useCallback((direction: "previous" | "next") => {
    const control = controlRef.current;
    if (!control) return;
    setError(null);
    if (direction === "previous") {
      control.previous();
    } else {
      control.next();
    }
  }, []);

  if (!available) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <p className={styles.status}>{t("control.unavailable")}</p>
        </div>
      </main>
    );
  }

  if (liveState.kind === "loading") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <p className={styles.status}>{t("auth.loading")}</p>
        </div>
      </main>
    );
  }

  if (liveState.kind === "error") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <p className={styles.status}>{t("control.couldNotLoadActive")}</p>
        </div>
      </main>
    );
  }

  if (liveState.kind === "none") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.statusBlock}>
            <p className={styles.status}>{t("control.noActivePresentation")}</p>
            <button
              type="button"
              onClick={() => router.push(STUDIO_ROUTES.library)}
            >
              {t("editor.backToLibrary")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const disabled = view === null || !view.enabled;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>PowerShow Control</h1>

        <p className={styles.status}>
          {view ? describeStatus(t, view.status) : t("control.awaitingPlayer")}
        </p>

        <div className={styles.buttons}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => go("previous")}
          >
            {t("control.previous")}
          </button>
          <button type="button" disabled={disabled} onClick={() => go("next")}>
            {t("control.next")}
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}
