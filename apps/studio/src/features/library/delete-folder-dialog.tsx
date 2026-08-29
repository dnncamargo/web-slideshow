"use client";

import { useEffect, useRef } from "react";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { Button } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";

import styles from "./presentation-library.module.css";

interface DeleteFolderDialogProps {
  folderName: string;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Local confirmation dialog for removing a folder's organization only.
 * Presentations remain private and are unfiled before the folder is deleted.
 */
export function DeleteFolderDialog({
  folderName,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteFolderDialogProps) {
  const { t } = useStudioI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!deleting) onCancel();
    }
  };

  return (
    <div className={styles.deleteDialogBackdrop}>
      <div
        ref={dialogRef}
        className={styles.deleteDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="powershow-delete-folder-dialog-title"
        aria-describedby="powershow-delete-folder-dialog-message"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2
          id="powershow-delete-folder-dialog-title"
          className={styles.deleteDialogTitle}
        >
          {t("library.deleteFolderDialogTitle", { name: folderName })}
        </h2>

        <p
          id="powershow-delete-folder-dialog-message"
          className={styles.deleteDialogText}
        >
          {t("library.deleteFolderDialogMessage", { name: folderName })}
        </p>

        {error ? (
          <p className={styles.deleteDialogError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.deleteDialogActions}>
          <Button size="compact" disabled={deleting} onClick={onCancel}>
            {t("library.cancel")}
          </Button>
          <Button variant="danger" size="compact" disabled={deleting} onClick={onConfirm}>
            {deleting ? t("library.deletingFolder") : t("library.deleteFolder")}
          </Button>
        </div>
      </div>
    </div>
  );
}
