"use client";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";
import type { LiveControlView } from "../live-control";
import type { PresenterPresentationState } from "./use-presenter-presentation";

import styles from "../control-page.module.css";

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

export interface PresenterViewProps {
  view: LiveControlView | null;
  sendFailed: boolean;
  presentationState: PresenterPresentationState;
  previous(): void;
  next(): void;
}

/**
 * Owns the /control presentation markup. Receives already-resolved Live and
 * published-presentation data from ControlPage.
 *
 * The slide counter uses LiveControlView.confirmedIndex (ACK-authoritative)
 * and the loaded published Presentation's slide count. It is shown only when
 * both are available and the confirmed index is in range, and only changes
 * after a Player ACK updates confirmedIndex.
 */
export function PresenterView({
  view,
  sendFailed,
  presentationState,
  previous,
  next,
}: PresenterViewProps) {
  const { t } = useStudioI18n();

  const disabled = view === null || !view.enabled;

  const slideCount =
    presentationState.kind === "ready"
      ? presentationState.presentation.slides.length
      : null;

  const confirmedIndex = view?.confirmedIndex ?? null;

  const showCounter =
    slideCount !== null &&
    confirmedIndex !== null &&
    confirmedIndex >= 0 &&
    confirmedIndex < slideCount;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>PowerShow Control</h1>

        <p className={styles.status}>
          {view ? describeStatus(t, view.status) : t("control.awaitingPlayer")}
        </p>

        {showCounter && (
          <p className={styles.counter}>
            {confirmedIndex + 1} / {slideCount}
          </p>
        )}

        <div className={styles.buttons}>
          <button type="button" disabled={disabled} onClick={previous}>
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
