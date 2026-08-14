"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import type { Presentation } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { EditorWorkspace } from "@/features/editor/editor-workspace";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";
import { getDefaultPresentationRepository } from "@/features/persistence/presentation-repository-instance";

const repository = getDefaultPresentationRepository();

type EditorStatus =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "loaded"; presentation: Presentation };

interface StudioEditorMountProps {
  presentationId: string | null;
}

/**
 * Client-only editor mount wrapper.
 *
 * Owns the async repository-loading boundary. It loads the canonical
 * Presentation identified by the route query parameter and only mounts
 * EditorWorkspace once it is available. No demo/blank/sessionStorage
 * fallback is substituted while loading.
 */
export function StudioEditorMount({
  presentationId,
}: StudioEditorMountProps) {
  const { t } = useStudioI18n();
  const router = useRouter();
  const [status, setStatus] = useState<EditorStatus>({ kind: "loading" });

  useEffect(() => {
    if (presentationId === null) {
      router.replace(STUDIO_ROUTES.library);

      return;
    }

    let cancelled = false;

    setStatus({ kind: "loading" });

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
        console.error(`Failed to load presentation "${presentationId}"`, error);

        if (!cancelled) {
          setStatus({ kind: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [presentationId, router]);

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

  return (
    <EditorWorkspace
      initialPresentation={status.presentation}
      onSave={(presentation) => repository.savePresentation(presentation)}
      onPublish={async () => {
        await repository.publishPresentation(status.presentation.id);
      }}
    />
  );
}