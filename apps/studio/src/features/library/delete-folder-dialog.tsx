"use client";

import { DangerConfirmDialog } from "../app/danger-confirm-dialog";
import { useStudioI18n } from "../i18n/studio-i18n-context";

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

  return (
    <DangerConfirmDialog
      title={t("library.deleteFolderDialogTitle", { name: folderName })}
      message={t("library.deleteFolderDialogMessage", { name: folderName })}
      confirmLabel={t("library.deleteFolder")}
      cancelLabel={t("library.cancel")}
      busy={deleting}
      busyConfirmLabel={t("library.deletingFolder")}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
