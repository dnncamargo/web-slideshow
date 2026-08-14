"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { isRealtimeDatabaseConfigured } from "./realtime-db";
import { writeControlCommand } from "./control-command-writer";
import type { ControlAction } from "./control-commands";

import styles from "./control-page.module.css";

export function ControlPage() {
  const { t } = useStudioI18n();
  const searchParams = useSearchParams();
  const publicationId = useMemo(
    () => searchParams.get("publication") ?? "",
    [searchParams],
  );
  const [revision, setRevision] = useState(() => Date.now());
  const [available, setAvailable] = useState(() =>
    isRealtimeDatabaseConfigured(),
  );
  const [sending, setSending] = useState<ControlAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled =
    publicationId.trim() === "" || !available || sending !== null;

  const send = useCallback(
    async (action: ControlAction) => {
      if (disabled || publicationId.trim() === "") {
        return;
      }

      setSending(action);
      setError(null);

      try {
        await writeControlCommand(publicationId, action, revision);
        setRevision((current) => current + 1);
      } catch (cause) {
        console.error("Control: failed to send command", cause);
        setError(t("control.sendFailed"));
      } finally {
        setSending(null);
      }
    },
    [disabled, publicationId, revision, t],
  );

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>PowerShow Control</h1>

        {publicationId.trim() === "" ? (
          <p className={styles.status}>{t("control.missingPublication")}</p>
        ) : !available ? (
          <p className={styles.status}>{t("control.unavailable")}</p>
        ) : (
          <div className={styles.buttons}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void send("previous")}
            >
              {t("control.previous")}
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => void send("next")}
            >
              {t("control.next")}
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}
