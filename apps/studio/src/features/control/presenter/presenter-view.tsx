"use client";

import { useEffect, useMemo, useState } from "react";

import { renderFontResources } from "@powershow/renderer";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";
import { LocaleSelector } from "@/features/i18n/locale-selector";
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

function useLocalClock(): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export interface PresenterViewProps {
  view: LiveControlView | null;
  sendFailed: boolean;
  presentationState: PresenterPresentationState;
  previous(): void;
  next(): void;
  end(): void;
}

/**
 * Owns the /control presentation markup. Receives already-resolved Live and
 * published-presentation data from ControlPage.
 *
 * The slide counter uses LiveControlView.confirmedIndex (ACK-authoritative)
 * and the loaded published Presentation's slide count. It is shown only when
 * both are available and the confirmed index is in range, and only changes
 * after a Player ACK updates confirmedIndex.
 *
 * The shell follows the Studio Editor as its visual baseline: a 52px top bar
 * (brand, centered presentation title, Locale + End) over a three-column body
 * (slide list / current preview / next preview + notes), a centered row of
 * Previous/Next arrow controls beneath the current slide with a secondary
 * Fullscreen control, and an unobtrusive footer (local clock, sync/latency,
 * ACK-confirmed counter). Fullscreen stays disabled: it is not wired to any
 * remote/protocol action.
 */
export function PresenterView({
  view,
  sendFailed,
  presentationState,
  previous,
  next,
  end,
}: PresenterViewProps) {
  const { t } = useStudioI18n();

  const clock = useLocalClock();

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

  const presentation =
    presentationState.kind === "ready" ? presentationState.presentation : null;

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
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <strong>
            <span>PowerShow</span>
          </strong>

          <span className={styles.brandSection}>Control</span>
        </div>

        <div className={styles.headerTitle} title={presentation?.title ?? ""}>
          <span>{presentation?.title ?? ""}</span>
        </div>

        <div className={styles.headerActions}>
          <LocaleSelector />

          <button type="button" className={styles.endButton} onClick={end}>
            {t("control.end")}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={presenterStyles.summaryColumn}>
          {presentation && (
            <PresenterSlideList
              presentation={presentation}
              confirmedIndex={confirmedIndex}
            />
          )}
        </aside>

        <section className={presenterStyles.currentColumn}>
          {fontResourcesCss && (
            <style data-powershow-font-resources>{fontResourcesCss}</style>
          )}

          {currentSlide && aspectRatio ? (
            <PresenterSlidePreview
              slide={currentSlide}
              aspectRatio={aspectRatio}
              variant="current"
            />
          ) : (
            <p className={styles.status}>{t("control.awaitingPlayer")}</p>
          )}

          <div className={presenterStyles.centerControls}>
            <button
              type="button"
              className={presenterStyles.arrowButton}
              disabled={!canGoPrevious}
              onClick={previous}
              aria-label={t("control.previous")}
              title={t("control.previous")}
            >
              <svg
                className={presenterStyles.arrowIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              className={presenterStyles.arrowButton}
              disabled={!canGoNext}
              onClick={next}
              aria-label={t("control.next")}
              title={t("control.next")}
            >
              <svg
                className={presenterStyles.arrowIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>

            <button
              type="button"
              className={presenterStyles.fullscreenButton}
              disabled
              aria-label={t("control.fullscreen")}
              title={t("control.fullscreen")}
            >
              <svg
                className={presenterStyles.fullscreenIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
              {t("control.fullscreen")}
            </button>
          </div>
        </section>

        <aside className={presenterStyles.nextColumn}>
          {nextSlide && aspectRatio && (
            <PresenterSlidePreview
              slide={nextSlide}
              aspectRatio={aspectRatio}
              variant="next"
            />
          )}

          <div className={presenterStyles.notesRegion}>
            {currentSlide && currentSlideNote !== "" && (
              <p className={presenterStyles.note}>{currentSlideNote}</p>
            )}

            {notesState.kind === "error" && (
              <p className={styles.error}>{t("notes.loadError")}</p>
            )}
          </div>
        </aside>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.clock}>{clock}</span>

          <span className={styles.footerDivider} aria-hidden="true" />

          {sendFailed && (
            <span className={styles.error}>{t("control.sendFailed")}</span>
          )}

          <span className={styles.footerStatus}>
            {view ? describeStatus(t, view.status) : t("control.awaitingPlayer")}
          </span>
        </div>

        {showCounter && (
          <span className={styles.counter}>
            {confirmedIndex + 1} / {slideCount}
          </span>
        )}
      </footer>
    </main>
  );
}