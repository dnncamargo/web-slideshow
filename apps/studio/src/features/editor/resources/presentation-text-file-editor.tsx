"use client";

import { useCallback, useState } from "react";

import type { PresentationTextFileResource } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import {
  StructuredTextEditor,
  type StructuredTextEditorProfile,
} from "../structured-text-editor";

import styles from "./presentation-text-file-editor.module.css";

function getEditorProfile(contentType: PresentationTextFileResource["contentType"]): StructuredTextEditorProfile {
  if (contentType === "application/json") return "json";
  if (contentType === "application/xml" || contentType === "image/svg+xml") return "xml";
  return "plain";
}

export function PresentationTextFileEditor({
  file,
  onSave,
  onExit,
  onDirtyChange,
}: {
  file: PresentationTextFileResource;
  onSave: (content: string) => void;
  onExit: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useStudioI18n();
  const [dirty, setDirty] = useState(false);
  const handleDirtyChange = useCallback((nextDirty: boolean) => {
    setDirty(nextDirty);
    onDirtyChange(nextDirty);
  }, [onDirtyChange]);

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

      <StructuredTextEditor
        title={file.name}
        baseline={file.source.content}
        profile={getEditorProfile(file.contentType)}
        ariaLabel={t("editor.textFileEditor")}
        onSave={onSave}
        onDirtyChange={handleDirtyChange}
        onExit={onExit}
      />
    </>
  );
}
