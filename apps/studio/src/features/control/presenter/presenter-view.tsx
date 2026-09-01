"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { renderFontResources } from "@powershow/renderer";
import {
  Button,
  Separator,
  Status,
  Topbar,
  TopbarActions,
  TopbarLocale,
  TopbarTitle,
} from "@powershow/ui";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";
import { LocaleSelector } from "@/features/i18n/locale-selector";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { ProductSurfaceBrand } from "@/features/app/product-surface-brand";
import type { LiveControlView } from "../live-control";
import type { ControlGalleryView } from "../use-live-gallery-control";
import type { PlayerOperationalStatus } from "../player-presence";
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

  if (status.kind === "player-changed") {
    return t("control.playerChanged");
  }

  if (status.latencyMs !== undefined) {
    return `${t("control.synced")} • ${Math.round(status.latencyMs)} ms`;
  }

  return t("control.synced");
}

function describeCombinedStatus(
  t: StudioTranslate,
  playerStatus: PlayerOperationalStatus | null | undefined,
  view: LiveControlView | null,
): string {
  const status = playerStatus;
  if (status === null || status === undefined || status.kind === "no-report") {
    return "No Player report";
  }
  if (status.kind === "starting") {
    return "Player starting…";
  }
  if (status.kind === "load-failed") {
    return "Player load failed";
  }
  if (status.kind === "disconnected") {
    return "Player disconnected";
  }
  return view === null || view.status.kind === "awaiting-player"
    ? "Player ready"
    : describeStatus(t, view.status);
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.matches("input, textarea, select, [contenteditable]") ||
    target.closest("[contenteditable]") !== null ||
    target.isContentEditable
  );
}

function GalleryInteractiveControls({ galleries, disabled, nextGallery, setGalleryExpanded, t }: {
  galleries: readonly ControlGalleryView[];
  disabled: boolean;
  nextGallery(elementId: string): void;
  setGalleryExpanded(elementId: string, expanded: boolean): void;
  t: StudioTranslate;
}) {
  return galleries.map((gallery, index) => {
    const label = galleries.length === 1 ? t("element.gallery") : `${t("element.gallery")} ${index + 1}`;
    const expansionLabel = t(gallery.expanded ? "control.galleryCollapse" : "control.galleryExpand");
    return <div className={presenterStyles.galleryGroup} key={gallery.elementId}>
      <span className={presenterStyles.galleryLabel}>{label}</span>
      <Button variant="secondary" size="compact" disabled={disabled || gallery.pending || gallery.itemCount <= 1} onClick={() => nextGallery(gallery.elementId)} aria-label={`${label}: ${t("control.galleryNextImage")}`}>{t("control.galleryNextImage")}</Button>
      <Button variant="secondary" size="compact" disabled={disabled || gallery.pending || gallery.itemCount === 0} onClick={() => setGalleryExpanded(gallery.elementId, !gallery.expanded)} aria-label={`${label}: ${expansionLabel}`}>{expansionLabel}</Button>
    </div>;
  });
}

export interface PresenterViewProps {
  view: LiveControlView | null;
  sendFailed: boolean;
  presentationState: PresenterPresentationState;
  galleries: readonly ControlGalleryView[];
  promotingVersionId: string | null;
  failedPromotionVersionId: string | null;
  playerStatus?: PlayerOperationalStatus | null;
  previous(): void;
  next(): void;
  goTo(index: number): void;
  followPlayer(): void;
  updatePlayer(targetVersionId: string): void;
  requestFullscreen(): void;
  nextGallery(elementId: string): void;
  setGalleryExpanded(elementId: string, expanded: boolean): void;
  end(): void;
}

/**
 * Owns the /studio/control presentation markup. Receives already-resolved Live and
 * published-presentation data from ControlPage.
 *
 * The slide counter uses the Control desired position (`presentationState
 * .displayIndex`, projected from the Control's desired live page across the
 * staged preview version) and the loaded published Presentation's slide count.
 * It is shown only when both are available and the desired index is in range,
 * and changes as soon as Control projects a new desired target, independent of
 * the lagging Player actual position.
 *
 * When status is `player-changed` the Control shows a contextual message and a
 * single "Follow Player" action; the displayed slide remains the Control's
 * desired slide until the operator chooses to follow.
 *
 * The shell follows the Studio Editor visual structure: a 52px top bar with
 * PowerShow Control branding, centered presentation title, Locale selector,
 * local clock, Live sync/latency status and End action. The body contains the
 * slide summary, current preview and next preview + notes. Previous/Next,
 * Fullscreen and the desired slide counter belong to the control row below the
 * current slide. Fullscreen sends an intent to the mounted Player.
 * There is no footer.
 */

export function PresenterView({
  view,
  sendFailed,
  presentationState,
  galleries,
  promotingVersionId,
  failedPromotionVersionId,
  playerStatus,
  previous,
  next,
  goTo,
  followPlayer,
  updatePlayer,
  requestFullscreen,
  nextGallery,
  setGalleryExpanded,
  end,
}: PresenterViewProps) {
  const { t } = useStudioI18n();

  const clock = useLocalClock();

  const disabled = view === null || !view.enabled;

  const slideCount =
    presentationState.kind === "ready"
      ? presentationState.presentation.slides.length
      : null;

  const displayIndex =
    presentationState.kind === "ready"
      ? presentationState.displayIndex
      : null;

  const pendingVersion =
    presentationState.kind === "ready"
      ? presentationState.pendingVersion
      : null;

  const promotingVersion =
    pendingVersion !== null &&
    promotingVersionId === pendingVersion.targetVersionId;
  const promotionFailed =
    pendingVersion !== null &&
    failedPromotionVersionId === pendingVersion.targetVersionId;

  const showCounter =
    slideCount !== null &&
    displayIndex !== null &&
    displayIndex >= 0 &&
    displayIndex < slideCount;

  const presentation =
    presentationState.kind === "ready" ? presentationState.presentation : null;

  const currentSlide =
    presentationState.kind === "ready" &&
    displayIndex !== null &&
    displayIndex >= 0 &&
    displayIndex < presentationState.presentation.slides.length
      ? presentationState.presentation.slides[displayIndex]
      : null;

  const nextSlide =
    presentationState.kind === "ready" &&
    displayIndex !== null &&
    displayIndex >= 0 &&
    displayIndex + 1 < presentationState.presentation.slides.length
      ? presentationState.presentation.slides[displayIndex + 1]
      : null;

  const aspectRatio =
    presentationState.kind === "ready"
      ? presentationState.presentation.aspectRatio
      : null;

  const canGoPrevious =
    pendingVersion === null &&
    !disabled &&
    displayIndex !== null &&
    displayIndex > 0;

  const canGoNext =
    pendingVersion === null &&
    !disabled &&
    displayIndex !== null &&
    displayIndex >= 0 &&
    presentation !== null &&
    displayIndex < presentation.slides.length - 1;

  const navigationDisabled = pendingVersion !== null || disabled;
  const showGalleryControls = pendingVersion === null && galleries.length > 0;
  const currentGalleryTargets = showGalleryControls
    ? galleries.map(({ elementId, targetIndex }) => ({ elementId, targetIndex }))
    : [];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && canGoPrevious) {
        event.preventDefault();
        previous();
      }

      if (event.key === "ArrowRight" && canGoNext) {
        event.preventDefault();
        next();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        end();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canGoNext, canGoPrevious, end, next, previous]);

  const isPlayerChanged = view?.status.kind === "player-changed";

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
      <Topbar mobileLayout="stack-title">
        {/* ========================================================
      BEGIN: BRAND
      ======================================================== */}

        <ProductSurfaceBrand surface="control">
          <Link className={styles.mobileLibraryLink} href={STUDIO_ROUTES.library}>
            {t("control.library")}
          </Link>
        </ProductSurfaceBrand>

        {/* ========================================================
      END: BRAND
      ======================================================== */}

        {/* ========================================================
      BEGIN: PRESENTATION TITLE
      ======================================================== */}

        <TopbarTitle title={presentation?.title ?? ""}>
          <span>{presentation?.title ?? ""}</span>
        </TopbarTitle>

        {/* ========================================================
      END: PRESENTATION TITLE
      ======================================================== */}

        {/* ========================================================
      BEGIN: TOPBAR CONTROLS
      ======================================================== */}

        <TopbarActions>
          <Status>{clock}</Status>

          <Separator />

          {sendFailed && (
            <Status tone="danger">{t("control.sendFailed")}</Status>
          )}

          <Status>{describeCombinedStatus(t, playerStatus, view)}</Status>

          <Link className={presenterStyles.maintenanceLink} href={STUDIO_ROUTES.controlMaintenance}>
            Maintenance
          </Link>

          <Button variant="danger" size="compact" onClick={end}>
            {t("control.end")}
          </Button>
        </TopbarActions>

        {/* ========================================================
      END: TOPBAR CONTROLS
      ======================================================== */}

        <TopbarLocale>
          <LocaleSelector />
        </TopbarLocale>
      </Topbar>

      <div className={styles.body}>
        <aside className={presenterStyles.summaryColumn}>
          <div className={presenterStyles.panelHeader}>
            {t("control.summary")}
          </div>

          {presentation && (
            <PresenterSlideList
              presentation={presentation}
              desiredPageIndex={displayIndex}
              navigationDisabled={navigationDisabled}
              onNavigate={goTo}
            />
          )}
        </aside>

        <section className={presenterStyles.currentColumn}>
          {fontResourcesCss && (
            <style data-powershow-font-resources>{fontResourcesCss}</style>
          )}
          {currentSlide && aspectRatio && presentation ? (
            <PresenterSlidePreview
              presentation={presentation}
              slide={currentSlide}
              aspectRatio={aspectRatio}
              variant="current"
              galleryTargets={currentGalleryTargets}
            />
          ) : (
            <p className={styles.status}>{t("control.awaitingPlayer")}</p>
          )}
        </section>

        <div className={presenterStyles.centerControls}>
          <div className={presenterStyles.controlPrimary}>
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
              disabled={disabled}
              onClick={requestFullscreen}
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
            {/* Future session timer slot. Renders only the desired slide
                counter until a canonical startedAt exists. */}
            <div className={styles.controlDivider} aria-hidden="true" />

            {showCounter && (
              <span className={styles.counter}>
                {displayIndex + 1} / {slideCount}
              </span>
            )}

            {isPlayerChanged && (
              <div
                className={presenterStyles.playerChanged}
                role="status"
              >
                <span>{t("control.playerChangedMessage")}</span>
                <button
                  type="button"
                  className={presenterStyles.followPlayerButton}
                  onClick={followPlayer}
                >
                  {t("control.followPlayer")}
                </button>
              </div>
            )}

            {pendingVersion && (
              <div
                className={
                  pendingVersion.projectedSlideRemoved
                    ? presenterStyles.publishedUpdateRemoved
                    : presenterStyles.publishedUpdate
                }
                role="status"
              >
                <div className={presenterStyles.publishedUpdateCopy}>
                  <strong>{t("control.newVersionPublished")}</strong>

                  {pendingVersion.projectedSlideRemoved ? (
                    <span>{t("control.projectedSlideRemoved")}</span>
                  ) : pendingVersion.structuralChange ? (
                    <span>{t("control.presentationStructureChanged")}</span>
                  ) : null}

                  {promotionFailed && (
                    <span className={styles.error}>
                      {t("control.updatePlayerFailed")}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className={presenterStyles.updatePlayerButton}
                  disabled={promotingVersion}
                  onClick={() =>
                    updatePlayer(pendingVersion.targetVersionId)
                  }
                >
                  {promotingVersion
                    ? t("control.updatingPlayer")
                    : t("control.updatePlayer")}
                </button>
              </div>
            )}
          </div>
        </div>

        {showGalleryControls && (
          <div className={presenterStyles.mobileInteractiveElementsControls} data-mobile-gallery-controls>
            <GalleryInteractiveControls galleries={galleries} disabled={disabled} nextGallery={nextGallery} setGalleryExpanded={setGalleryExpanded} t={t} />
          </div>
        )}

        <div className={presenterStyles.mobileLiveStatus}>
          <span className={styles.status}>{clock}</span>

          <div className={styles.controlDivider} aria-hidden="true" />

          {sendFailed && (
            <span className={styles.error}>{t("control.sendFailed")}</span>
          )}

          <span className={styles.topbarStatus}>
            {describeCombinedStatus(t, playerStatus, view)}
          </span>
        </div>

        <aside className={presenterStyles.nextColumn}>
          {nextSlide && aspectRatio && presentation && (
            <PresenterSlidePreview
              presentation={presentation}
              slide={nextSlide}
              aspectRatio={aspectRatio}
              variant="next"
            />
          )}

          <div className={presenterStyles.notesRegion}>
            {showGalleryControls && (
              <div className={presenterStyles.interactiveElementsControls} data-gallery-controls>
                <GalleryInteractiveControls galleries={galleries} disabled={disabled} nextGallery={nextGallery} setGalleryExpanded={setGalleryExpanded} t={t} />
              </div>
            )}
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
