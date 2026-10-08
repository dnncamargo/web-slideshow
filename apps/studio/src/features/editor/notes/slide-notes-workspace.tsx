"use client";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import type { EditorNotesStatus } from "../editor-notes-state";
import type { SlideNotes } from "../../persistence/presentation-notes";

import styles from "./slide-notes-workspace.module.css";

interface SlideNotesWorkspaceProps {
  slideNotes: SlideNotes;
  status: EditorNotesStatus;
  hasCurrentSaveError: boolean;
  onAddPointedNote: () => void;
  onPointedNoteChange: (pointedNoteId: string, text: string) => void;
  onRemovePointedNote: (pointedNoteId: string) => void;
}

export function SlideNotesWorkspace({
  slideNotes,
  status,
  hasCurrentSaveError,
  onAddPointedNote,
  onPointedNoteChange,
  onRemovePointedNote,
}: SlideNotesWorkspaceProps) {
  const { t } = useStudioI18n();

  const ready = status === "ready";
  const isError = status === "error" || hasCurrentSaveError;

  const statusLabel =
    status === "loading"
      ? t("notes.loading")
      : status === "error"
        ? t("notes.loadError")
        : hasCurrentSaveError
          ? t("notes.saveError")
          : "";

  return (
    <aside className={styles.notesWorkspace}>
      <div className={styles.notesHeader}>
        <h2 className={styles.notesHeaderTitle}>{t("notes.pointed")}</h2>

        <div className={styles.notesHeaderActions}>
          {statusLabel && (
            <span
              className={styles.notesStatus}
              data-error={isError || undefined}
            >
              {statusLabel}
            </span>
          )}
          <button
            type="button"
            className={styles.addPointedNoteButton}
            disabled={!ready}
            aria-label={t("notes.addPointed")}
            onClick={onAddPointedNote}
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.notesContent}>
        {slideNotes.pointed.length === 0 ? (
          <p className={styles.pointedNotesEmpty}>{t("notes.noPointed")}</p>
        ) : (
          <div className={styles.pointedNotesList}>
            {slideNotes.pointed.map((pointedNote, index) => {
              const number = index + 1;
              const label = t("notes.pointedLabel", { number });

              return (
                <div className={styles.pointedNoteRow} key={pointedNote.id}>
                  <span
                    className={styles.pointedNoteNumber}
                    aria-hidden="true"
                  >
                    [{number}]
                  </span>
                  <textarea
                    className={styles.pointedNoteTextarea}
                    value={pointedNote.text}
                    disabled={!ready}
                    placeholder={t("notes.pointedPlaceholder")}
                    aria-label={label}
                    onChange={(event) => {
                      onPointedNoteChange(pointedNote.id, event.target.value);
                    }}
                    spellCheck
                  />
                  <button
                    type="button"
                    className={styles.removePointedNoteButton}
                    disabled={!ready}
                    aria-label={t("notes.removePointed", { number })}
                    onClick={() => onRemovePointedNote(pointedNote.id)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
