"use client";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import type { EditorNotesStatus } from "../editor-notes-state";

import styles from "./slide-notes-workspace.module.css";

interface SlideNotesWorkspaceProps {
  note: string;
  status: EditorNotesStatus;
  isSaving: boolean;
  hasSaveError: boolean;
  onChange: (note: string) => void;
}

export function SlideNotesWorkspace({
  note,
  status,
  isSaving,
  hasSaveError,
  onChange,
}: SlideNotesWorkspaceProps) {
  const { t } = useStudioI18n();

  const ready = status === "ready";
  const isError = status === "error" || hasSaveError;

  const statusLabel =
    status === "loading"
      ? t("notes.loading")
      : status === "error"
        ? t("notes.loadError")
        : isSaving
          ? t("notes.saving")
          : hasSaveError
            ? t("notes.saveError")
            : "";

  return (
    <aside className={styles.notesWorkspace}>
      <div className={styles.notesHeader}>
        <span>{t("notes.title")}</span>

        {statusLabel && (
          <span className={styles.notesStatus} data-error={isError || undefined}>
            {statusLabel}
          </span>
        )}
      </div>

      <div className={styles.notesContent}>
        <textarea
          className={styles.notesTextarea}
          value={note}
          disabled={!ready}
          placeholder={t("notes.placeholder")}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          spellCheck
        />
      </div>
    </aside>
  );
}
