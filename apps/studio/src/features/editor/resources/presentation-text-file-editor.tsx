"use client";

import { useState } from "react";

import type { PresentationTextFileResource } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./presentation-text-file-editor.module.css";

export function PresentationTextFileEditor({
  file,
  onSave,
  onExit,
}: {
  file: PresentationTextFileResource;
  onSave: (content: string) => void;
  onExit: () => void;
}) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState(file.source.content);
  const dirty = draft !== file.source.content;

  return (
    <>
      <aside className={styles.contextPanel} data-text-file-context>
        <div className={styles.contextHeader}>{t("editor.textFileEditing")}</div>
        <div className={styles.contextContent}>
          <h2 className={styles.fileName}>{file.name}</h2>
          <dl className={styles.metadata}>
            <div className={styles.metadataRow}>
              <dt className={styles.metadataLabel}>{t("editor.textFileKind")}</dt>
              <dd className={styles.metadataValue}>{t(`customLibrary.file.kind.${file.kind}`)}</dd>
            </div>
            <div className={styles.metadataRow}>
              <dt className={styles.metadataLabel}>{t("editor.textFileContentType")}</dt>
              <dd className={styles.metadataValue}>{file.contentType}</dd>
            </div>
          </dl>
          <p className={`${styles.status} ${dirty ? styles.statusModified : ""}`} data-text-file-status>
            {dirty ? t("editor.textFileModified") : t("editor.textFileClean")}
          </p>
        </div>
      </aside>

      <section className={styles.editorArea} data-text-file-editor-region>
        <div className={styles.editorToolbar}>
          <span className={styles.editorToolbarTitle}>{file.name}</span>
          <div className={styles.editorToolbarActions}>
            <button
              type="button"
              className={styles.toolbarAction}
              data-text-file-action="save"
              onClick={() => {
                if (dirty) onSave(draft);
              }}
            >
              {t("topbar.save")}
            </button>
            <button
              type="button"
              className={styles.toolbarAction}
              data-text-file-action="discard"
              disabled={!dirty}
              onClick={() => setDraft(file.source.content)}
            >
              {t("editor.textFileDiscard")}
            </button>
            <button
              type="button"
              className={`${styles.toolbarAction} ${styles.exitAction}`}
              data-text-file-action="exit"
              disabled={dirty}
              onClick={onExit}
            >
              {t("editor.exitTextEditing")}
            </button>
          </div>
        </div>
        <textarea
          className={styles.textArea}
          data-text-file-editor
          aria-label={t("editor.textFileEditor")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
        />
      </section>
    </>
  );
}
