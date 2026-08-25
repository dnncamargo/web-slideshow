"use client";

import { Button } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { CustomLibraryItemRecord } from "./custom-library-repository";
import styles from "../library/presentation-library.module.css";

interface CustomLibraryDeleteDialogProps {
  record: CustomLibraryItemRecord | null;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CustomLibraryDeleteDialog({
  record,
  deleting,
  error,
  onCancel,
  onConfirm,
}: CustomLibraryDeleteDialogProps) {
  const { t } = useStudioI18n();

  if (!record) return null;

  return (
    <div className={styles.deleteDialogBackdrop}>
      <div className={styles.deleteDialog} role="dialog" aria-modal="true" aria-labelledby="powershow-custom-library-delete-title">
        <h2 id="powershow-custom-library-delete-title" className={styles.deleteDialogTitle}>
          {t("customLibrary.deleteTitle")}
        </h2>
        <p className={styles.deleteDialogText}>
          {t("customLibrary.deleteBody", { name: record.item.name })}
        </p>
        {error ? <p className={styles.deleteDialogError} role="alert">{error}</p> : null}
        <div className={styles.deleteDialogActions}>
          <Button size="compact" disabled={deleting} onClick={onCancel}>
            {t("customLibrary.cancel")}
          </Button>
          <Button variant="danger" size="compact" disabled={deleting} onClick={onConfirm}>
            {deleting ? t("customLibrary.deleting") : t("customLibrary.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
