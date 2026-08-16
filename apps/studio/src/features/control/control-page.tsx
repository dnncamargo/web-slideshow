"use client";

import { useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { useRouter } from "next/navigation";

import { isRealtimeDatabaseConfigured } from "./realtime-db";
import { useLiveSessionControl } from "./use-live-session-control";
import type { LiveControlView } from "./live-control";

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
  const { liveState, view, sendFailed, previous, next } =
    useLiveSessionControl();
  const [available] = useState(() => isRealtimeDatabaseConfigured());

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
            onClick={previous}
          >
            {t("control.previous")}
          </button>
          <button type="button" disabled={disabled} onClick={next}>
            {t("control.next")}
          </button>
        </div>

        {sendFailed && <p className={styles.error}>{t("control.sendFailed")}</p>}
      </div>
    </main>
  );
}
