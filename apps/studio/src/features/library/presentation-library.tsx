"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";

import { useStudioAuth } from "@/features/auth/studio-auth-provider";

import { buildStudioEditorHref } from "@/features/app/studio-routes";

import {
  createBlankPresentation,
  getDefaultPresentationRepository,
} from "@/features/persistence/presentation-repository-instance";
import type { PresentationRepository } from "@/features/persistence/presentation-repository";
import type { PresentationSummary } from "@/features/persistence/presentation-persistence";

import { subscribeLiveCurrent, activateLivePresentation, endLivePresentation, type LiveState } from "@/features/control/live-current";

import styles from "./presentation-library.module.css";

interface PresentationLibraryProps {
  repository?: PresentationRepository;
}

type LibraryStatus = "loading" | "ready" | "error";

export function PresentationLibrary({
  repository = getDefaultPresentationRepository(),
}: PresentationLibraryProps) {
  const { t } = useStudioI18n();
  const router = useRouter();
  const { user, signOut } = useStudioAuth();

  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [summaries, setSummaries] = useState<PresentationSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });

  const mountedRef = useRef(true);

  function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    signOut()
      .catch((cause) => {
        console.error("Library: sign out failed", cause);
      })
      .finally(() => {
        if (mountedRef.current) {
          setSigningOut(false);
        }
      });
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPresentations = useCallback(async () => {
    setStatus("loading");
    setLoadError(false);

    try {
      const items = await repository.listPresentations();

      if (!mountedRef.current) {
        return;
      }

      setSummaries(items);
      setStatus("ready");
    } catch (error) {
      console.error("Library: could not load presentations", error);

      if (mountedRef.current) {
        setLoadError(true);
        setStatus("error");
      }
    }
  }, [repository]);

  useEffect(() => {
    void loadPresentations();
  }, [loadPresentations]);

  useEffect(() => {
    const unsub = subscribeLiveCurrent(setLiveState);
    return () => unsub?.();
  }, []);

  const handleNew = useCallback(async () => {
    if (creating) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const presentation = createBlankPresentation();
      await repository.createPresentation(presentation);

      if (!mountedRef.current) {
        return;
      }

      router.push(buildStudioEditorHref(presentation.id));
    } catch (error) {
      console.error("Library: could not create presentation", error);

      if (mountedRef.current) {
        setCreateError(t("library.couldNotCreate"));
      }
    } finally {
      if (mountedRef.current) {
        setCreating(false);
      }
    }
  }, [creating, repository, router, t]);

  const handleOpen = useCallback(
    (id: string) => {
      if (openingId !== null) {
        return;
      }

      setOpeningId(id);
      router.push(buildStudioEditorHref(id));
    },
    [openingId, router],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      if (archivingId !== null) {
        return;
      }

      setArchivingId(id);
      const previous = summaries;

      try {
        await repository.archivePresentation(id);

        if (!mountedRef.current) {
          return;
        }

        const items = await repository.listPresentations();

        if (mountedRef.current) {
          setSummaries(items);
        }
      } catch {
        if (mountedRef.current) {
          setCreateError(t("library.couldNotArchive"));
          setSummaries(previous);
        }
      } finally {
        if (mountedRef.current) {
          setArchivingId(null);
        }
      }
    },
    [archivingId, repository, summaries, t],
  );

  const handlePresent = useCallback(
    async (summary: PresentationSummary) => {
      if (!summary.publication) return;
      try {
        await activateLivePresentation(summary.publication.publicationId, summary.publication.currentVersionId);
        router.push(STUDIO_ROUTES.control);
      } catch (err) {
        console.error("Library: present failed", err);
        setCreateError(t("library.couldNotActivate"));
      }
    },
    [router, t],
  );

  const handleEnd = useCallback(async () => {
    try {
      await endLivePresentation();
    } catch (err) {
      console.error("Library: end failed", err);
      setCreateError(t("library.couldNotEnd"));
    }
  }, [t]);

  return (
    <div className={styles.library}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>{t("library.title")}</h1>

          {user?.displayName ?? user?.email ? (
            <span className={styles.headerUser}>
              {user?.displayName ?? user?.email}
            </span>
          ) : null}
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={creating}
            onClick={() => void handleNew()}
          >
            {creating ? t("library.creating") : t("library.new")}
          </button>

          <button
            type="button"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut ? t("auth.signingOut") : t("auth.signOut")}
          </button>
        </div>
      </header>

      {createError && <p className={styles.errorText}>{createError}</p>}

      <div className={styles.content}>
        {status === "loading" && <p>{t("library.loading")}</p>}

        {status === "error" && (
          <div className={styles.stateBlock}>
            <p>{t("library.couldNotLoad")}</p>

            <button type="button" onClick={() => void loadPresentations()}>
              {t("library.retry")}
            </button>
          </div>
        )}

        {status === "ready" && summaries.length === 0 && (
          <p className={styles.stateBlock}>{t("library.empty")}</p>
        )}

        {status === "ready" && summaries.length > 0 && (
          <ul className={styles.list}>
            {summaries.map((summary) => (
              <li key={summary.id} className={styles.card}>
                <div className={styles.cardInfo}>
                  <strong>{summary.title || t("library.untitled")}</strong>

                  <span>{summary.id}</span>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    disabled={openingId !== null}
                    onClick={() => void handleOpen(summary.id)}
                  >
                    {openingId === summary.id
                      ? t("library.opening")
                      : t("library.edit")}
                  </button>

                  {liveState.kind === "active" && liveState.live.publicationId === summary.publication?.publicationId ? (
                    <>
                      <button
                        type="button"
                        className={styles.controlButton}
                        onClick={() => router.push(STUDIO_ROUTES.control)}
                      >
                        {t("library.control")}
                      </button>
                      <button
                        type="button"
                        className={styles.endButton}
                        onClick={() => void handleEnd()}
                      >
                        {t("library.end")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.presentButton}
                      disabled={!summary.publication}
                      title={!summary.publication ? t("library.publishBefore") : undefined}
                      onClick={() => void handlePresent(summary)}
                    >
                      <span className={styles.buttonIcon} aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          width="12"
                          height="12"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <polygon points="6 3 20 12 6 21 6 3" />
                        </svg>
                      </span>
                      {t("library.present")}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={archivingId !== null}
                    onClick={() => void handleArchive(summary.id)}
                  >
                    {archivingId === summary.id
                      ? t("library.archiving")
                      : t("library.archive")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
