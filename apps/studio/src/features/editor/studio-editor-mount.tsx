"use client";

import { useEffect, useRef, useState } from "react";

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
        <div data-powershow-recovery-unrecoverable="true">
          <h2>{t("recovery.unrecoverableTitle")}</h2>

          <p>{t("recovery.unrecoverableExplanation")}</p>

          <button
            type="button"
            onClick={() => router.push(STUDIO_ROUTES.library)}
          >
            {t("recovery.backToLibrary")}
          </button>
        </div>
      );
    }

    return (
      <div data-powershow-recovery="recoverable">
        <h2>{t("recovery.title")}</h2>

        <p>{t("recovery.explanation")}</p>

        <p>
          {t("recovery.issueCount", {
            count: status.inspection.issues.length,
          })}
        </p>

        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen
            ? t("recovery.hideDetails")
            : t("recovery.viewDetails")}
        </button>

        {detailsOpen && (
          <ul data-powershow-recovery-details="true">
            {status.inspection.issues.map((issue, index) => (
              <li
                key={index}
                data-powershow-recovery-issue={index}
              >
                <span>
                  {t("recovery.detailsPath")}: {formatRecoveryIssuePath(issue.path)}
                </span>

                {issue.id ? (
                  <span>
                    {t("recovery.detailsId")}: {issue.id}
                  </span>
                ) : null}

                {issue.elementType ? (
                  <span>
                    {t("recovery.detailsType")}: {issue.elementType}
                  </span>
                ) : null}

                <span>
                  {t("recovery.detailsReason")}: {issue.reason}
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => router.push(STUDIO_ROUTES.library)}
        >
          {t("recovery.backToLibrary")}
        </button>

        <button
          type="button"
          data-powershow-recovery-open="true"
          onClick={() =>
            setStatus({ kind: "recovery-confirm", inspection: status.inspection })
          }
        >
          {t("recovery.removeAndOpen")}
        </button>
      </div>
    );
  }

  if (status.kind === "recovery-confirm") {
    return (
      <div data-powershow-recovery-confirm="true">
        <h2>{t("recovery.confirmTitle")}</h2>

        <p>{t("recovery.confirmBody")}</p>

        <button
          type="button"
          data-powershow-recovery-cancel="true"
          onClick={() =>
            setStatus({ kind: "recovery", inspection: status.inspection })
          }
        >
          {t("recovery.cancel")}
        </button>

        <button
          type="button"
          data-powershow-recovery-confirm-action="true"
          onClick={() => runRepair(status.inspection)}
        >
          {t("recovery.confirm")}
        </button>
      </div>
    );
  }

  if (status.kind === "recovery-repairing") {
    return <div>{t("recovery.repairing")}</div>;
  }

  if (status.kind === "recovery-failed") {
    return (
      <div data-powershow-recovery-failed="true">
        <h2>{t("recovery.repairFailed")}</h2>

        <button
          type="button"
          onClick={() => router.push(STUDIO_ROUTES.library)}
        >
          {t("recovery.backToLibrary")}
        </button>
      </div>
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