"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import {
  Button,
  Topbar,
  TopbarActions,
  TopbarLocale,
  TopbarTitle,
} from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import { LocaleSelector } from "../i18n/locale-selector";
import { STUDIO_ROUTES, buildStudioEditorHref } from "../app/studio-routes";
import { ProductSurfaceBrand } from "../app/product-surface-brand";
import { useStudioAuth } from "../auth/studio-auth-provider";
import {
  createBlankPresentation,
  getDefaultPresentationRepository,
} from "../persistence/presentation-repository-instance";
import type { PresentationRepository } from "../persistence/presentation-repository";
import type { PresentationSummary } from "../persistence/presentation-persistence";
import {
  subscribeLiveCurrent,
  activateLivePresentation,
  endLivePresentation,
  type LiveState,
} from "../control/live-current";

import {
  clearPresentationSelectionOnDestinationChange,
  type LibraryDestination,
} from "./presentation-library-logic";
import { PresentationList } from "./presentation-list";
import { PresentationToolbar } from "./presentation-toolbar";
import { StudioSidebar } from "./studio-sidebar";
import styles from "./presentation-library.module.css";

interface PresentationLibraryProps {
  repository?: PresentationRepository;
}

type LibraryStatus = "loading" | "ready" | "error";

function destinationTitle(
  destination: LibraryDestination,
  t: ReturnType<typeof useStudioI18n>["t"],
): string {
  switch (destination) {
    case "all":
      return t("library.all");
    case "folders":
      return t("library.folders");
    case "archived":
      return t("library.archived");
    case "styles":
      return t("library.styles");
    case "palettes":
      return t("library.palettes");
  }
}

function destinationPlaceholder(
  destination: Exclude<LibraryDestination, "all">,
  t: ReturnType<typeof useStudioI18n>["t"],
): string {
  return t(`library.destination.${destination}`);
}

export function PresentationLibrary({
  repository = getDefaultPresentationRepository(),
}: PresentationLibraryProps) {
  const { t } = useStudioI18n();
  const router = useRouter();
  const { user, signOut } = useStudioAuth();

  const [destination, setDestination] = useState<LibraryDestination>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [summaries, setSummaries] = useState<PresentationSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPresentations = useCallback(async () => {
    setStatus("loading");

    try {
      const items = await repository.listPresentations();

      if (!mountedRef.current) return;

      setSummaries(items);
      setStatus("ready");
    } catch (error) {
      console.error("Library: could not load presentations", error);

      if (mountedRef.current) {
        setStatus("error");
      }
    }
  }, [repository]);

  useEffect(() => {
    queueMicrotask(() => void loadPresentations());
  }, [loadPresentations]);

  useEffect(() => {
    const unsubscribe = subscribeLiveCurrent(setLiveState);
    return () => unsubscribe?.();
  }, []);

  const handleSignOut = useCallback(() => {
    if (signingOut) return;

    setSigningOut(true);
    signOut()
      .catch((cause) => console.error("Library: sign out failed", cause))
      .finally(() => {
        if (mountedRef.current) setSigningOut(false);
      });
  }, [signingOut, signOut]);

  const handleDestinationChange = useCallback((next: LibraryDestination) => {
    setDestination(next);
    setSelectedId(clearPresentationSelectionOnDestinationChange());
  }, []);

  const handleNew = useCallback(async () => {
    if (creating) return;

    setCreating(true);
    setActionError(null);

    try {
      const presentation = createBlankPresentation();
      await repository.createPresentation(presentation);

      if (mountedRef.current) router.push(buildStudioEditorHref(presentation.id));
    } catch (error) {
      console.error("Library: could not create presentation", error);
      if (mountedRef.current) setActionError(t("library.couldNotCreate"));
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  }, [creating, repository, router, t]);

  const handleOpen = useCallback(
    (id: string) => {
      if (openingId !== null) return;
      setOpeningId(id);
      router.push(buildStudioEditorHref(id));
    },
    [openingId, router],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      if (archivingId !== null) return;

      setArchivingId(id);
      const previous = summaries;

      try {
        await repository.archivePresentation(id);
        if (!mountedRef.current) return;

        const items = await repository.listPresentations();
        if (mountedRef.current) {
          setSummaries(items);
          setSelectedId(null);
        }
      } catch (error) {
        console.error("Library: could not archive presentation", error);
        if (mountedRef.current) {
          setActionError(t("library.couldNotArchive"));
          setSummaries(previous);
        }
      } finally {
        if (mountedRef.current) setArchivingId(null);
      }
    },
    [archivingId, repository, summaries, t],
  );

  const handlePresent = useCallback(
    async (summary: PresentationSummary) => {
      if (!summary.publication) return;

      try {
        await activateLivePresentation(
          summary.publication.publicationId,
          summary.publication.currentVersionId,
        );
        router.push(STUDIO_ROUTES.control);
      } catch (error) {
        console.error("Library: present failed", error);
        if (mountedRef.current) setActionError(t("library.couldNotActivate"));
      }
    },
    [router, t],
  );

  const handleEnd = useCallback(async () => {
    try {
      await endLivePresentation();
    } catch (error) {
      console.error("Library: end failed", error);
      if (mountedRef.current) setActionError(t("library.couldNotEnd"));
    }
  }, [t]);

  const selected = summaries.find((summary) => summary.id === selectedId) ?? null;
  const isAllDestination = destination === "all";

  return (
    <div className={styles.library}>
      <Topbar>
        <ProductSurfaceBrand surface="studio" />

        <TopbarTitle>
          <span className={styles.headerUser}>
            {user?.displayName ?? user?.email ?? ""}
          </span>
        </TopbarTitle>

        <TopbarActions>
          <Button
            variant="secondary"
            size="compact"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut ? t("auth.signingOut") : t("auth.signOut")}
          </Button>
        </TopbarActions>

        <TopbarLocale>
          <LocaleSelector />
        </TopbarLocale>
      </Topbar>

      {actionError ? (
        <p className={styles.errorText} role="alert">
          {actionError}
        </p>
      ) : null}

      <div className={styles.workspace}>
        <StudioSidebar
          destination={destination}
          onDestinationChange={handleDestinationChange}
        />

        <main className={styles.main}>
          <div className={styles.workspaceHeading}>
            <div>
              <p className={styles.eyebrow}>{t("library.title")}</p>
              <h1>{destinationTitle(destination, t)}</h1>
            </div>
            {isAllDestination ? (
              <PresentationToolbar
                selected={selected}
                liveState={liveState}
                creating={creating}
                openingId={openingId}
                archivingId={archivingId}
                onNew={() => void handleNew()}
                onEdit={handleOpen}
                onPresent={(summary) => void handlePresent(summary)}
                onControl={() => router.push(STUDIO_ROUTES.control)}
                onEnd={() => void handleEnd()}
                onArchive={(id) => void handleArchive(id)}
              />
            ) : null}
          </div>

          {isAllDestination ? (
            <section className={styles.listWorkspace} aria-live="polite">
              {status === "loading" ? (
                <p className={styles.stateBlock}>{t("library.loading")}</p>
              ) : null}

              {status === "error" ? (
                <div className={styles.stateBlock}>
                  <p>{t("library.couldNotLoad")}</p>
                  <Button size="compact" onClick={() => void loadPresentations()}>
                    {t("library.retry")}
                  </Button>
                </div>
              ) : null}

              {status === "ready" && summaries.length === 0 ? (
                <p className={styles.stateBlock}>{t("library.empty")}</p>
              ) : null}

              {status === "ready" && summaries.length > 0 ? (
                <PresentationList
                  summaries={summaries}
                  selectedId={selectedId}
                  liveState={liveState}
                  openingId={openingId}
                  onSelect={setSelectedId}
                />
              ) : null}
            </section>
          ) : (
            <section className={styles.placeholder}>
              <p className={styles.placeholderTitle}>{destinationTitle(destination, t)}</p>
              <p>{destinationPlaceholder(destination, t)}</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
