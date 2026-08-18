"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { useRouter } from "next/navigation";

import { isRealtimeDatabaseConfigured } from "./realtime-db";
import { useLiveSessionControl } from "./use-live-session-control";
import { usePresenterPresentation } from "./presenter/use-presenter-presentation";
import { PresenterView } from "./presenter/presenter-view";
import { endLivePresentation } from "./live-current";
import type { PresenterPresentationState } from "./presenter/use-presenter-presentation";
import { resolveLivePageId } from "./presenter/use-presenter-presentation";

import styles from "./control-page.module.css";

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
    previous,
    next,
    followPlayer,
    updatePlayer,
  } = useLiveSessionControl({ resolvePageId, resolvePageIndex });
  const presentationState = usePresenterPresentation(
    liveState,
    view?.enabled === true ? view.desiredPageIndex : null,
  );
  const [available] = useState(() => isRealtimeDatabaseConfigured());

  useEffect(() => {
    presentationStateRef.current = presentationState;
  }, [presentationState]);

  const end = () => {
    void endLivePresentation().catch((error: unknown) => {
      console.error("Control: end failed", error);
    });
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

  return (
    <PresenterView
      view={view}
      sendFailed={sendFailed}
      presentationState={presentationState}
      previous={previous}
      next={next}
      followPlayer={followPlayer}
      updatePlayer={updatePlayer}
      promotingVersionId={promotingVersionId}
      failedPromotionVersionId={failedPromotionVersionId}
      end={end}
    />
  );
}
