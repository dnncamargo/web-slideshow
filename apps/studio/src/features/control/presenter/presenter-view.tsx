"use client";

import { useMemo } from "react";

import { renderFontResources } from "@powershow/renderer";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";
import type { LiveControlView } from "../live-control";
import type { PresenterPresentationState } from "./use-presenter-presentation";
import { usePresenterNotes } from "./use-presenter-notes";
import { PresenterSlidePreview } from "./presenter-slide-preview";
import { PresenterSlideList } from "./presenter-slide-list";

import styles from "../control-page.module.css";
import presenterStyles from "./presenter-view.module.css";

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

  const currentSlide =
    presentationState.kind === "ready" &&
    confirmedIndex !== null &&
    confirmedIndex >= 0 &&
    confirmedIndex < presentationState.presentation.slides.length
      ? presentationState.presentation.slides[confirmedIndex]
      : null;

  const nextSlide =
    presentationState.kind === "ready" &&
    confirmedIndex !== null &&
    confirmedIndex >= 0 &&
    confirmedIndex + 1 < presentationState.presentation.slides.length
      ? presentationState.presentation.slides[confirmedIndex + 1]
      : null;

  const aspectRatio =
    presentationState.kind === "ready"
      ? presentationState.presentation.aspectRatio
      : null;

  const presentation =
    presentationState.kind === "ready" ? presentationState.presentation : null;

  const canGoPrevious =
    !disabled && confirmedIndex !== null && confirmedIndex > 0;

  const canGoNext =
    !disabled &&
    confirmedIndex !== null &&
    confirmedIndex >= 0 &&
    presentation !== null &&
    confirmedIndex < presentation.slides.length - 1;

  const notesState = usePresenterNotes(presentation);

  const currentSlideNote =
    currentSlide !== null && notesState.kind === "ready"
      ? (notesState.notes.bySlideId[currentSlide.id] ?? "")
      : "";

  const fontResourcesCss = useMemo(
    () =>
      presentationState.kind === "ready"
        ? renderFontResources(presentationState.presentation.resources?.fonts)
        : "",
    [presentationState],
  );

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>PowerShow Control</h1>

        {fontResourcesCss && (
          <style data-powershow-font-resources>{fontResourcesCss}</style>
        )}

        <div className={presenterStyles.previewsRegion}>
          <div className={presenterStyles.previews}>
            {currentSlide && aspectRatio && (
              <PresenterSlidePreview
                slide={currentSlide}
                aspectRatio={aspectRatio}
                variant="current"
              />
            )}

            {nextSlide && aspectRatio && (
              <PresenterSlidePreview
                slide={nextSlide}
                aspectRatio={aspectRatio}
                variant="next"
              />
            )}
          </div>
        </div>

        {presentation && (
          <PresenterSlideList
            presentation={presentation}
            confirmedIndex={confirmedIndex}
          />
        )}

        {currentSlide && currentSlideNote !== "" && (
          <p className={presenterStyles.note}>{currentSlideNote}</p>
        )}

        {notesState.kind === "error" && (
          <p className={styles.error}>{t("notes.loadError")}</p>
        )}

        <div className={presenterStyles.liveStatus}>
          <p className={styles.status}>
            {view ? describeStatus(t, view.status) : t("control.awaitingPlayer")}
          </p>

          {showCounter && (
            <p className={styles.counter}>
              {confirmedIndex + 1} / {slideCount}
            </p>
          )}
        </div>

        <div className={styles.buttons}>
          <button type="button" disabled={!canGoPrevious} onClick={previous}>
            {t("control.previous")}
          </button>
          <button type="button" disabled={!canGoNext} onClick={next}>
            {t("control.next")}
          </button>
        </div>

        {sendFailed && (
          <p className={styles.error}>{t("control.sendFailed")}</p>
        )}
      </div>
    </main>
  );
}
