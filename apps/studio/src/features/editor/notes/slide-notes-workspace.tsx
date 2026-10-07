"use client";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import type { EditorNotesStatus } from "../editor-notes-state";
import type { SlideNotes } from "../../persistence/presentation-notes";

import styles from "./slide-notes-workspace.module.css";

interface SlideNotesWorkspaceProps {
  slideNotes: SlideNotes;
  note: string;
  status: EditorNotesStatus;
  hasCurrentSaveError: boolean;
  onChange: (note: string) => void;
  onAddPointedNote: () => void;
  onPointedNoteChange: (pointedNoteId: string, text: string) => void;
  onRemovePointedNote: (pointedNoteId: string) => void;
}

export function SlideNotesWorkspace({
  slideNotes,
  note,
  status,
  hasCurrentSaveError,
  onChange,
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
        <span>{t("notes.title")}</span>

        {statusLabel && (
          <span
            className={styles.notesStatus}
            data-error={isError || undefined}
          >
            {statusLabel}
          </span>
        )}
      </div>

      <div className={styles.notesContent}>
        <section
          className={styles.notesSection}
          aria-labelledby="general-note-heading"
        >
          <h2 id="general-note-heading" className={styles.notesSectionHeading}>
            {t("notes.general")}
          </h2>
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
        </section>

        <section
          className={styles.notesSection}
          aria-labelledby="pointed-notes-heading"
        >
          <div className={styles.pointedNotesHeader}>
            <h2
              id="pointed-notes-heading"
              className={styles.notesSectionHeading}
            >
              {t("notes.pointed")}
            </h2>
            <button
              type="button"
              className={styles.addPointedNoteButton}
              disabled={!ready}
              onClick={onAddPointedNote}
            >
              {t("notes.addPointed")}
            </button>
          </div>

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
        </section>
      </div>
    </aside>
  );
}
