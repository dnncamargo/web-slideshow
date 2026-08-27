"use client";

import { Button } from "@powershow/ui";
import { useStudioI18n } from "../i18n/studio-i18n-context";
import styles from "../library/presentation-library.module.css";
import type { CustomLibraryFontRecord } from "./custom-library-font";

interface CustomLibraryFontDeleteDialogProps {
  record: CustomLibraryFontRecord | null;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CustomLibraryFontDeleteDialog({ record, deleting, error, onCancel, onConfirm }: CustomLibraryFontDeleteDialogProps) {
  const { t } = useStudioI18n();
  if (!record) return null;

  return (
    <div className={styles.deleteDialogBackdrop}>
      <div className={styles.deleteDialog} role="dialog" aria-modal="true" aria-labelledby="powershow-custom-library-font-delete-title">
        <h2 id="powershow-custom-library-font-delete-title" className={styles.deleteDialogTitle}>{t("customLibrary.fontDelete.title")}</h2>
        <p className={styles.deleteDialogText}>{t("customLibrary.fontDelete.body", { family: record.font.family })}</p>
        {error ? <p className={styles.deleteDialogError} role="alert">{error}</p> : null}
        <div className={styles.deleteDialogActions}>
          <Button size="compact" disabled={deleting} onClick={onCancel}>{t("customLibrary.cancel")}</Button>
          <Button variant="danger" size="compact" disabled={deleting} onClick={onConfirm}>
            {deleting ? t("customLibrary.fontDelete.deleting") : t("customLibrary.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
