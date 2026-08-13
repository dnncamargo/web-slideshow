"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { storeOpenedPresentation } from "@/features/editor/opened-presentation-store";

import {
  createBlankPresentation,
  getDefaultPresentationRepository,
} from "@/features/persistence/presentation-repository-instance";
import type { PresentationRepository } from "@/features/persistence/presentation-repository";
import type { PresentationSummary } from "@/features/persistence/presentation-persistence";

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

  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [summaries, setSummaries] = useState<PresentationSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const mountedRef = useRef(true);

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

      storeOpenedPresentation(presentation);
      router.push("/studio/editor");
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
    async (id: string) => {
      if (openingId !== null) {
        return;
      }

      setOpeningId(id);

      try {
        const presentation = await repository.getPresentation(id);

        if (!mountedRef.current) {
          return;
        }

        if (!presentation) {
          setCreateError(t("library.notFound"));

          return;
        }

        storeOpenedPresentation(presentation);
        router.push("/studio/editor");
      } catch {
        if (mountedRef.current) {
          setCreateError(t("library.couldNotOpen"));
        }
      } finally {
        if (mountedRef.current) {
          setOpeningId(null);
        }
      }
    },
    [openingId, repository, router, t],
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

  return (
    <div className={styles.library}>
      <header className={styles.header}>
        <h1>{t("library.title")}</h1>

        <button
          type="button"
          className={styles.primaryButton}
          disabled={creating}
          onClick={() => void handleNew()}
        >
          {creating ? t("library.creating") : t("library.new")}
        </button>
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
                      : t("library.open")}
                  </button>

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
