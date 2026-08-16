"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { renderFontResources } from "@powershow/renderer";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";
import { LocaleSelector } from "@/features/i18n/locale-selector";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
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
 * The shell follows the Studio Editor visual structure: a 52px top bar with
 * PowerShow Control branding, centered presentation title, Locale selector,
 * local clock, Live sync/latency status and End action. The body contains the
 * slide summary, current preview and next preview + notes. Previous/Next,
 * Fullscreen and the ACK-confirmed slide counter belong to the control row
 * below the current slide. Fullscreen stays disabled until its protocol is
 * implemented. There is no footer.
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
      <header className={styles.topbar}>
        {/* ========================================================
      BEGIN: BRAND
      ======================================================== */}

        <div>
          <strong>
            <span>PowerShow</span>
          </strong>

          <span className={styles.topbarSection}>Control</span>
        </div>

        {/* ========================================================
      END: BRAND
      ======================================================== */}

        {/* ========================================================
      BEGIN: PRESENTATION TITLE
      ======================================================== */}

        <div
          className={styles.presentationTitle}
          title={presentation?.title ?? ""}
        >
          <span>{presentation?.title ?? ""}</span>
        </div>

        {/* ========================================================
      END: PRESENTATION TITLE
      ======================================================== */}

        {/* ========================================================
      BEGIN: TOPBAR CONTROLS
      ======================================================== */}

        <div className={styles.topbarControls}>
          <LocaleSelector />

          <div className={styles.topbarDivider} aria-hidden="true" />

          <span className={styles.status}>{clock}</span>

          {sendFailed && (
            <span className={styles.error}>{t("control.sendFailed")}</span>
          )}

          <span className={styles.topbarStatus}>
            {view
              ? describeStatus(t, view.status)
              : t("control.awaitingPlayer")}
          </span>

          <button type="button" className={styles.endButton} onClick={end}>
            {t("control.end")}
          </button>
        </div>

        {/* ========================================================
      END: TOPBAR CONTROLS
      ======================================================== */}

        <Link className={styles.mobileLibraryLink} href={STUDIO_ROUTES.library}>
          {t("control.library")}
        </Link>
      </header>

      <div className={styles.body}>
        <aside className={presenterStyles.summaryColumn}>
          <div className={presenterStyles.panelHeader}>
            {t("control.summary")}
          </div>

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
        </section>

        <div className={presenterStyles.centerControls}>
          <div className={presenterStyles.controlPrimary}>
            <div className={presenterStyles.mobileLocale}>
              <LocaleSelector />
            </div>

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

              <span className={presenterStyles.fullscreenLabel}>
                {t("control.fullscreen")}
              </span>
            </button>

            <button
              type="button"
              className={presenterStyles.mobileEndButton}
              onClick={end}
            >
              {t("control.end")}
            </button>
          </div>

          <div className={presenterStyles.controlMeta}>
            {/* Future session timer slot. Renders only the ACK-confirmed
                slide counter until a canonical startedAt exists. */}
            <div className={styles.controlDivider} aria-hidden="true" />

            {showCounter && (
              <span className={styles.counter}>
                {confirmedIndex + 1} / {slideCount}
              </span>
            )}
          </div>
        </div>

        <div className={presenterStyles.mobileLiveStatus}>
          <span className={styles.status}>{clock}</span>

          <div className={styles.controlDivider} aria-hidden="true" />

          {sendFailed && (
            <span className={styles.error}>{t("control.sendFailed")}</span>
          )}

          <span className={styles.topbarStatus}>
            {view
              ? describeStatus(t, view.status)
              : t("control.awaitingPlayer")}
          </span>
        </div>

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
    </main>
  );
}
