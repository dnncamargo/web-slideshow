"use client";

import { useCallback, useEffect, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { useRouter } from "next/navigation";

import { isRealtimeDatabaseConfigured } from "./realtime-db";
import { writeControlCommand } from "./control-command-writer";
import { subscribeLiveCurrent, type LiveState } from "./live-current";
import type { ControlAction } from "./control-commands";

import styles from "./control-page.module.css";

export function ControlPage() {
  const { t } = useStudioI18n();
  const router = useRouter();
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const [revision, setRevision] = useState(() => Date.now());
  const [available] = useState(() => isRealtimeDatabaseConfigured());
  const [sending, setSending] = useState<ControlAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeLiveCurrent(setLiveState);
    return () => unsub?.();
  }, []);

  const send = useCallback(
    async (action: ControlAction) => {
      const publicationId =
        liveState.kind === "active" ? liveState.live.publicationId : null;

      if (publicationId === null) return;
      setSending(action);
      setError(null);
      try {
        await writeControlCommand(publicationId, action, revision);
        setRevision((r) => r + 1);
      } catch (cause) {
        console.error("Control: failed to send command", cause);
        setError(t("control.sendFailed"));
      } finally {
        setSending(null);
      }
    },
    [liveState, revision, t],
  );

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
            <button type="button" onClick={() => router.push(STUDIO_ROUTES.library)}>
              {t("editor.backToLibrary")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const publicationId = liveState.live.publicationId;
  const disabled = sending !== null;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>PowerShow Control</h1>

        <div className={styles.buttons}>
          <button type="button" disabled={disabled} onClick={() => void send("previous")}>
            {t("control.previous")}
          </button>
          <button type="button" disabled={disabled} onClick={() => void send("next")}>
            {t("control.next")}
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}
