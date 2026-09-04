"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@powershow/ui";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { useRouter } from "next/navigation";

import { isRealtimeDatabaseConfigured } from "./realtime-db";
import { useLiveSessionControl } from "./use-live-session-control";
import { useLiveGalleryControl } from "./use-live-gallery-control";
import { useLiveScriptedActionControl } from "./use-live-scripted-action-control";
import { usePresenterPresentation } from "./presenter/use-presenter-presentation";
import { PresenterView } from "./presenter/presenter-view";
import {
  activateLivePresentation,
  endLivePresentation,
  type LiveCurrent,
} from "./live-current";
import type { PresenterPresentationState } from "./presenter/use-presenter-presentation";
import { resolveLivePageId } from "./presenter/use-presenter-presentation";

import styles from "./control-page.module.css";

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

export function ControlPage() {
  const { t } = useStudioI18n();
  const router = useRouter();
  const presentationStateRef = useRef<PresenterPresentationState | null>(null);
  const resolvePageId = useCallback(
    (pageIndex: number) =>
      resolveLivePageId(presentationStateRef.current, pageIndex),
    [],
  );
  const resolvePageIndex = useCallback((pageId: string) => {
    const livePresentation =
      presentationStateRef.current?.kind === "ready"
        ? presentationStateRef.current.livePresentation
        : null;

    if (!livePresentation) {
      return null;
    }

    const index = livePresentation.slides.findIndex((slide) => slide.id === pageId);

    return index >= 0 ? index : null;
  }, []);
  const {
    liveState,
    view,
    sendFailed,
    promotingVersionId,
    failedPromotionVersionId,
    playerStatus,
    previous,
    next,
    goTo,
    followPlayer,
    updatePlayer,
    requestFullscreen,
  } = useLiveSessionControl({ resolvePageId, resolvePageIndex });
  const presentationState = usePresenterPresentation(
    liveState,
    view?.enabled === true ? view.desiredPageId : null,
  );
  const galleryControl = useLiveGalleryControl({
    live: liveState.kind === "active" ? liveState.live : null,
    livePresentation:
      presentationState.kind === "ready"
        ? presentationState.livePresentation
        : null,
    desiredPageId: view?.enabled === true ? view.desiredPageId : null,
  });
  const scriptedActionControl = useLiveScriptedActionControl({
    live: liveState.kind === "active" ? liveState.live : null,
    livePresentation:
      presentationState.kind === "ready"
        ? presentationState.livePresentation
        : null,
    desiredPageId: view?.enabled === true ? view.desiredPageId : null,
    actualPageId: view?.actualPageId ?? null,
    controlSynced: view?.status.kind === "synced",
    playerStatus,
    controlsBlocked:
      presentationState.kind === "ready" && presentationState.pendingVersion !== null,
  });
  const [available] = useState(() => isRealtimeDatabaseConfigured());
  const lastLiveIdentityRef = useRef<Pick<LiveCurrent, "publicationId" | "currentVersionId"> | null>(null);
  const [reactivationInFlight, setReactivationInFlight] = useState(false);

  useEffect(() => {
    if (liveState.kind !== "active") {
      return;
    }

    lastLiveIdentityRef.current = {
      publicationId: liveState.live.publicationId,
      currentVersionId: liveState.live.currentVersionId,
    };
  }, [liveState]);

  useEffect(() => {
    presentationStateRef.current = presentationState;
  }, [presentationState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        liveState.kind !== "none" ||
        event.repeat ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.key !== "Escape" ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      router.push(STUDIO_ROUTES.library);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [liveState.kind, router]);

  const end = () => {
    void endLivePresentation().catch((error: unknown) => {
      console.error("Control: end failed", error);
    });
  };

  const reactivateLastPresentation = () => {
    const lastLiveIdentity = lastLiveIdentityRef.current;
    if (lastLiveIdentity === null || reactivationInFlight) {
      return;
    }

    setReactivationInFlight(true);
    void activateLivePresentation(
      lastLiveIdentity.publicationId,
      lastLiveIdentity.currentVersionId,
    )
      .catch((error: unknown) => {
        console.error("Control: re-display failed", error);
      })
      .finally(() => setReactivationInFlight(false));
  };

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
    const hasLastLiveIdentity = lastLiveIdentityRef.current !== null;

    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.statusBlock}>
            <p className={styles.status}>{t("control.noActivePresentation")}</p>
            {hasLastLiveIdentity && (
              <Button
                variant="primary"
                disabled={reactivationInFlight}
                onClick={reactivateLastPresentation}
              >
                {t(
                  reactivationInFlight
                    ? "control.reDisplayingLastPresentation"
                    : "control.reDisplayLastPresentation",
                )}
              </Button>
            )}
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

  return (
    <PresenterView
      view={view}
      sendFailed={sendFailed || galleryControl.sendFailed || scriptedActionControl.sendFailed}
      presentationState={presentationState}
      galleries={galleryControl.galleries}
      scriptedActionGroups={scriptedActionControl.groups}
      scriptedActionsEnabled={scriptedActionControl.actionsEnabled}
      previous={previous}
      next={next}
      goTo={goTo}
      followPlayer={followPlayer}
      updatePlayer={updatePlayer}
      requestFullscreen={requestFullscreen}
      nextGallery={galleryControl.nextGallery}
      setGalleryExpanded={galleryControl.setGalleryExpanded}
      triggerScriptedAction={scriptedActionControl.triggerAction}
      promotingVersionId={promotingVersionId}
      failedPromotionVersionId={failedPromotionVersionId}
      playerStatus={playerStatus}
      end={end}
    />
  );
}
