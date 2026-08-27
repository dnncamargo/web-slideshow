"use client";

import { Button } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { CustomLibraryPaletteRecord } from "./custom-library-palette-repository";
import styles from "../library/presentation-library.module.css";

interface CustomLibraryPaletteDeleteDialogProps {
  record: CustomLibraryPaletteRecord | null;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CustomLibraryPaletteDeleteDialog({
  record,
  deleting,
  error,
  onCancel,
  onConfirm,
}: CustomLibraryPaletteDeleteDialogProps) {
  const { t } = useStudioI18n();

  if (!record) return null;

  return (
    <div className={styles.deleteDialogBackdrop}>
      <div
        className={styles.deleteDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="powershow-custom-library-palette-delete-title"
      >
        <h2 id="powershow-custom-library-palette-delete-title" className={styles.deleteDialogTitle}>
          {t("customLibrary.paletteDelete.title")}
        </h2>
        <p className={styles.deleteDialogText}>
          {t("customLibrary.paletteDelete.body", { name: record.palette.name })}
        </p>
        {error ? <p className={styles.deleteDialogError} role="alert">{error}</p> : null}
        <div className={styles.deleteDialogActions}>
          <Button size="compact" disabled={deleting} onClick={onCancel}>
            {t("customLibrary.cancel")}
          </Button>
          <Button variant="danger" size="compact" disabled={deleting} onClick={onConfirm}>
            {deleting ? t("customLibrary.paletteDelete.deleting") : t("customLibrary.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
