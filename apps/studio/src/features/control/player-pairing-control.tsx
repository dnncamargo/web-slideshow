"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@web-slideshow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";

import {
  claimPlayerByPin,
  normalizePairingPin,
} from "./player-pairing";
import {
  getRealtimeDatabaseOrNull,
  isRealtimeDatabaseConfigured,
} from "./realtime-db";
import styles from "./control-page.module.css";

/** Compact Control-owned entry point for the one-time Player pairing flow. */
export function PlayerPairingControl() {
  const { t } = useStudioI18n();
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  if (!isRealtimeDatabaseConfigured() || connected) return null;

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    void (async () => {
      try {
        const database = getRealtimeDatabaseOrNull();
        if (database === null) {
          throw new Error(t("control.pairingUnavailable"));
        }
        await claimPlayerByPin(database, pin);
        setPin("");
        setConnected(true);
      } catch (claimError) {
        setError(
          claimError instanceof Error
            ? claimError.message
            : t("control.pairingFailed"),
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <section className={styles.pairing} aria-label={t("control.connectPlayer")}>
      <form className={styles.pairingForm} onSubmit={onSubmit}>
        <span className={styles.pairingTitle}>{t("control.connectPlayer")}</span>
        <label className={styles.pairingField}>
          <span>{t("control.pin")}</span>
          <input
            className={styles.pairingInput}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(event) => {
              const next = event.target.value.replace(/[^\d\s]/g, "").slice(0, 7);
              setPin(next);
              setError(null);
            }}
            placeholder="123 456"
            aria-label={t("control.pin")}
          />
        </label>
        <Button
          type="submit"
          size="compact"
          variant="primary"
          disabled={submitting || normalizePairingPin(pin) === null}
        >
          {submitting ? t("control.connectingPlayer") : t("control.connect")}
        </Button>
      </form>
      {error !== null && <span className={styles.pairingError}>{error}</span>}
    </section>
  );
}
