"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { useRouter } from "next/navigation";

import type { Presentation } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { EditorWorkspace } from "@/features/editor/editor-workspace";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { getDefaultPresentationRepository } from "@/features/persistence/presentation-repository-instance";
import { getDefaultPresentationNotesRepository } from "@/features/persistence/presentation-notes-repository-instance";
import {
  InvalidPersistedPresentationError,
  PresentationRecoveryFailedError,
} from "@/features/persistence/persistence-errors";
import type {
  PresentationRecoveryInspection,
} from "@/features/persistence/presentation-repository";
import type { RecoveryIssue } from "@/features/persistence/presentation-recovery";

import styles from "./studio-editor-mount.module.css";

const repository = getDefaultPresentationRepository();
const notesRepository = getDefaultPresentationNotesRepository();

type EditorStatus =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "recovery"; inspection: PresentationRecoveryInspection }
  | { kind: "recovery-confirm"; inspection: PresentationRecoveryInspection }
  | { kind: "recovery-repairing"; inspection: PresentationRecoveryInspection }
  | { kind: "recovery-failed"; inspection: PresentationRecoveryInspection }
  | { kind: "loaded"; presentation: Presentation };

interface StudioEditorMountProps {
  presentationId: string | null;
}

/** Deterministic path display, e.g. slides[0].elements[2]. */
function formatRecoveryIssuePath(path: RecoveryIssue["path"]): string {
  let output = "";

  for (const segment of path) {
    if (typeof segment === "number") {
      output += `[${segment}]`;
    } else {
      output += output.length === 0 ? segment : `.${segment}`;
    }
  }

  return output;
}

function RecoveryPanel({
  children,
  className,
  ...attributes
}: ComponentPropsWithoutRef<"main">) {
  return (
    <main className={styles.recoveryScreen} {...attributes}>
      <section
        className={`${styles.recoveryPanel} ${className ?? ""}`}
        data-powershow-recovery-panel="true"
      >
        {children}
      </section>
    </main>
  );
}

/**
 * Client-only editor mount wrapper.
 *
 * Owns the async repository-loading boundary. It loads the canonical
 * Presentation identified by the route query parameter and only mounts
 * EditorWorkspace once it is available. No demo/blank/sessionStorage
 * fallback is substituted while loading.
 *
 * Only InvalidPersistedPresentationError triggers the recovery
 * inspection flow; every other load failure keeps the generic error
 * state. The recovery flow never writes on mount: the destructive
 * repair requires explicit confirmation and performs the repair
 * exactly once.
 */
export function StudioEditorMount({
  presentationId,
}: StudioEditorMountProps) {
  const { t } = useStudioI18n();
  const router = useRouter();
  // Mount-lifetime guard for the user-triggered repair request. Unlike a
  // request cancellation flag, it is never reset by later effects: it
  // only tracks whether the component is still mounted.
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<EditorStatus>({ kind: "loading" });
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Per-effect cancellation: a newer presentationId effect creates its
    // own closure flag, so an older request can never update state after
    // a newer effect has started.
    let cancelled = false;

    if (presentationId === null) {
      router.replace(STUDIO_ROUTES.library);

      return;
    }

    setStatus({ kind: "loading" });
    setDetailsOpen(false);

    repository
      .getPresentation(presentationId)
      .then((presentation) => {
        if (cancelled) {
          return;
        }

        if (presentation === null) {
          setStatus({ kind: "not-found" });

          return;
        }

        setStatus({ kind: "loaded", presentation });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (!(error instanceof InvalidPersistedPresentationError)) {
          console.error(
            `Failed to load presentation "${presentationId}"`,
            error,
          );

          setStatus({ kind: "error" });

          return;
        }

        repository
          .inspectPresentationRecovery(presentationId)
          .then((inspection) => {
            if (!cancelled) {
              setStatus({ kind: "recovery", inspection });
            }
          })
          .catch((inspectionError) => {
            console.error(
              `Failed to inspect presentation "${presentationId}" for recovery`,
              inspectionError,
            );

            if (!cancelled) {
              setStatus({ kind: "error" });
            }
          });
      });

    return () => {
      cancelled = true;
    };
  }, [presentationId, router]);

  function runRepair(inspection: PresentationRecoveryInspection) {
    if (presentationId === null) {
      return;
    }

    setStatus({ kind: "recovery-repairing", inspection });

    repository
      .repairPresentation(presentationId)
      .then((result) => {
        if (mountedRef.current) {
          setStatus({ kind: "loaded", presentation: result.presentation });
        }
      })
      .catch((error) => {
        console.error(`Failed to repair presentation "${presentationId}"`, error);

        if (!mountedRef.current) {
          return;
        }

        if (error instanceof PresentationRecoveryFailedError) {
          setStatus({
            kind: "recovery",
            inspection: { ...inspection, status: "unrecoverable" },
          });

          return;
        }

        setStatus({ kind: "recovery-failed", inspection });
      });
  }

  if (status.kind === "loading") {
    return <div>{t("editor.loading")}</div>;
  }

  if (status.kind === "not-found") {
    return (
      <div>
        {t("library.notFound")}

        <button type="button" onClick={() => router.push(STUDIO_ROUTES.library)}>
          {t("editor.backToLibrary")}
        </button>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div>
        {t("editor.couldNotLoad")}

        <button type="button" onClick={() => router.push(STUDIO_ROUTES.library)}>
          {t("editor.backToLibrary")}
        </button>
      </div>
    );
  }

  if (status.kind === "recovery") {
    if (status.inspection.status === "unrecoverable") {
      return (
        <RecoveryPanel data-powershow-recovery-unrecoverable="true">
          <header className={styles.recoveryHeader}>
            <h1 className={styles.recoveryTitle}>
              {t("recovery.unrecoverableTitle")}
            </h1>

            <p className={styles.recoveryExplanation}>
              {t("recovery.unrecoverableExplanation")}
            </p>
          </header>

          <div className={styles.recoveryActions}>
            <button
              className={styles.secondaryAction}
              type="button"
              onClick={() => router.push(STUDIO_ROUTES.library)}
            >
              {t("recovery.backToLibrary")}
            </button>
          </div>
        </RecoveryPanel>
      );
    }

    return (
      <RecoveryPanel data-powershow-recovery="recoverable">
        <header className={styles.recoveryHeader}>
          <h1 className={styles.recoveryTitle}>{t("recovery.title")}</h1>

          <p className={styles.recoveryExplanation}>{t("recovery.explanation")}</p>
        </header>

        <section className={styles.recoverySummary} data-powershow-recovery-summary="true">
          <p className={styles.issueCount}>
            {t("recovery.issueCount", { count: status.inspection.issues.length })}
          </p>

          <button
            className={styles.detailsToggle}
            type="button"
            aria-controls="powershow-recovery-details"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? t("recovery.hideDetails") : t("recovery.viewDetails")}
          </button>
        </section>

        {detailsOpen && (
          <ul
            className={styles.recoveryDetails}
            id="powershow-recovery-details"
            data-powershow-recovery-details="true"
          >
            {status.inspection.issues.map((issue, index) => (
              <li className={styles.recoveryIssue} key={index} data-powershow-recovery-issue={index}>
                <code className={styles.recoveryIssuePath}>
                  {formatRecoveryIssuePath(issue.path)}
                </code>
                <dl className={styles.recoveryIssueMetadata}>
                  {issue.id ? (
                    <div>
                      <dt>{t("recovery.detailsId")}</dt>
                      <dd>{issue.id}</dd>
                    </div>
                  ) : null}

                  {issue.elementType ? (
                    <div>
                      <dt>{t("recovery.detailsType")}</dt>
                      <dd>{issue.elementType}</dd>
                    </div>
                  ) : null}

                  <div>
                    <dt>{t("recovery.detailsReason")}</dt>
                    <dd>{issue.reason}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.recoveryActions} data-powershow-recovery-actions="true">
          <button
            className={styles.primaryAction}
            type="button"
            data-powershow-recovery-open="true"
            onClick={() => setStatus({ kind: "recovery-confirm", inspection: status.inspection })}
          >
            {t("recovery.removeAndOpen")}
          </button>
          <button
            className={styles.secondaryAction}
            type="button"
            onClick={() => router.push(STUDIO_ROUTES.library)}
          >
            {t("recovery.backToLibrary")}
          </button>
        </div>
      </RecoveryPanel>
    );
  }

  if (status.kind === "recovery-confirm") {
    return (
      <RecoveryPanel className={styles.warningPanel} data-powershow-recovery-confirm="true">
        <header className={styles.recoveryHeader}>
          <h1 className={styles.recoveryTitle}>{t("recovery.confirmTitle")}</h1>

          <p className={styles.recoveryExplanation}>{t("recovery.confirmBody")}</p>
        </header>

        <div className={styles.recoveryActions}>
          <button
            className={styles.dangerAction}
            type="button"
            data-powershow-recovery-confirm-action="true"
            onClick={() => runRepair(status.inspection)}
          >
            {t("recovery.confirm")}
          </button>
          <button
            className={styles.secondaryAction}
            type="button"
            data-powershow-recovery-cancel="true"
            onClick={() => setStatus({ kind: "recovery", inspection: status.inspection })}
          >
            {t("recovery.cancel")}
          </button>
        </div>
      </RecoveryPanel>
    );
  }

  if (status.kind === "recovery-repairing") {
    return (
      <RecoveryPanel>
        <p className={styles.statusMessage} role="status" aria-live="polite">
          {t("recovery.repairing")}
        </p>
      </RecoveryPanel>
    );
  }

  if (status.kind === "recovery-failed") {
    return (
      <RecoveryPanel data-powershow-recovery-failed="true">
        <header className={styles.recoveryHeader}>
          <h1 className={styles.recoveryTitle}>{t("recovery.repairFailed")}</h1>
        </header>

        <div className={styles.recoveryActions}>
          <button
            className={styles.secondaryAction}
            type="button"
            onClick={() => router.push(STUDIO_ROUTES.library)}
          >
            {t("recovery.backToLibrary")}
          </button>
        </div>
      </RecoveryPanel>
    );
  }

  return (
    <EditorWorkspace
      initialPresentation={status.presentation}
      onSave={(presentation) => repository.savePresentation(presentation)}
      onPublish={async () => {
        await repository.publishPresentation(status.presentation.id);
      }}
      notesRepository={notesRepository}
    />
  );
}
