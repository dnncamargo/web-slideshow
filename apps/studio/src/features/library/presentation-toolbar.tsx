"use client";

import { Button, Separator } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { PresentationSummary } from "../persistence/presentation-persistence";
import type { LiveState } from "../control/live-current";

import { resolvePresentationToolbarState } from "./presentation-library-logic";
import styles from "./presentation-library.module.css";

interface PresentationToolbarProps {
  selected: PresentationSummary | null;
  liveState: LiveState;
  creating: boolean;
  openingId: string | null;
  archivingId: string | null;
  restoringId: string | null;
  deletingId: string | null;
  transferBusy: boolean;
  newFolderDisabled: boolean;
  folderDestination: boolean;
  folderDeleteDisabled: boolean;
  onNew: () => void;
  onNewFolder: () => void;
  onDeleteFolder: () => void;
  onEdit: (id: string) => void;
  onPresent: (summary: PresentationSummary) => void;
  onControl: () => void;
  onEnd: () => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (summary: PresentationSummary) => void;
  onImport: () => void;
  onExport: () => void;
}

/**
 * Management toolbar with two zones:
 *
 * - CONTEXT: selected presentation title and fixed contextual actions. Empty
 *            when nothing is selected; the title is the only elastic item.
 * - RIGHT:   fixed global management actions (New, Import/Export transfer
 *            slot, New folder or Delete folder).
 */
export function PresentationToolbar({
  selected,
  liveState,
  creating,
  openingId,
  archivingId,
  restoringId,
  deletingId,
  transferBusy,
  newFolderDisabled,
  folderDestination,
  folderDeleteDisabled,
  onNew,
  onNewFolder,
  onDeleteFolder,
  onEdit,
  onPresent,
  onControl,
  onEnd,
  onArchive,
  onRestore,
  onDelete,
  onImport,
  onExport,
}: PresentationToolbarProps) {
  const { t } = useStudioI18n();
  const state = resolvePresentationToolbarState(selected, liveState);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={t("library.actions")}>
      {/* ====================================================
          CONTEXT: selected presentation title and local actions
          ==================================================== */}
      <div className={styles.toolbarCenter}>
        {state.mode !== "none" && selected ? (
          <span className={styles.toolbarContext} role="group" aria-label={selected.title}>
            <span className={styles.toolbarSelection} title={selected.title}>
              {selected.title || t("library.untitled")}
            </span>

            <span className={styles.toolbarLocalActions}>
              <Separator />

              {state.actions.includes("present") ? (
                <Button
                  variant="primary"
                  size="compact"
                  disabled={!state.canPresent}
                  title={!state.canPresent ? t("library.publishBefore") : undefined}
                  onClick={() => {
                    if (selected && state.canPresent) onPresent(selected);
                  }}
                >
                  {t("library.present")}
                </Button>
              ) : null}

              {state.actions.includes("control") ? (
                <Button variant="primary" size="compact" onClick={onControl}>
                  {t("library.control")}
                </Button>
              ) : null}

              {state.actions.includes("end") ? (
                <Button variant="danger" size="compact" onClick={onEnd}>
                  {t("library.end")}
                </Button>
              ) : null}

              {state.actions.includes("edit") && selected ? (
                <Button
                  className={styles.mobileHidden}
                  size="compact"
                  disabled={openingId !== null}
                  onClick={() => onEdit(selected.id)}
                >
                  {openingId === selected.id ? t("library.opening") : t("library.edit")}
                </Button>
              ) : null}

              {state.actions.includes("archive") && selected ? (
                <Button
                  variant="danger"
                  size="compact"
                  disabled={archivingId !== null}
                  onClick={() => onArchive(selected.id)}
                >
                  {archivingId === selected.id ? t("library.archiving") : t("library.archive")}
                </Button>
              ) : null}

              {state.actions.includes("restore") && selected ? (
                <Button
                  size="compact"
                  disabled={restoringId !== null}
                  onClick={() => onRestore(selected.id)}
                >
                  {restoringId === selected.id ? t("library.restoring") : t("library.restore")}
                </Button>
              ) : null}

              {state.actions.includes("delete") && selected ? (
                <Button
                  variant="danger"
                  size="compact"
                  disabled={deletingId !== null || selected.publication !== undefined}
                  title={
                    selected.publication !== undefined
                      ? t("library.deletePublishedUnavailable")
                      : undefined
                  }
                  onClick={() => onDelete(selected)}
                >
                  {deletingId === selected.id ? t("library.deleting") : t("library.delete")}
                </Button>
              ) : null}
            </span>
          </span>

        ) : null}
      </div>

      {/* ============================================================
          RIGHT: global management actions
          ============================================================ */}
      <div className={styles.toolbarRight}>
        {/* GLOBAL: New presentation is always available. */}
        <Button
          variant="primary"
          size="compact"
          disabled={creating}
          onClick={onNew}
          aria-label={t("library.new")}
        >
          {creating ? t("library.creating") : t("library.new")}
        </Button>

        {/* TRANSFER SLOT: Import (no selection) or Export (selection). */}
        {state.transferAction === "import" ? (
          <Button
            size="compact"
            disabled={transferBusy}
            onClick={onImport}
            aria-label={t("library.import")}
          >
            {t("library.import")}
          </Button>
        ) : (
          <Button
            size="compact"
            disabled={transferBusy}
            onClick={onExport}
            aria-label={t("library.export")}
          >
            {t("library.export")}
          </Button>
        )}

        {folderDestination ? (
          <Button
            variant="danger"
            size="compact"
            disabled={folderDeleteDisabled}
            onClick={onDeleteFolder}
            aria-label={t("library.deleteFolder")}
          >
            {t("library.deleteFolder")}
          </Button>
        ) : (
          /* GLOBAL: New folder opens the inline creation control in the
             Folders sidebar area. */
          <Button
            size="compact"
            disabled={newFolderDisabled}
            onClick={onNewFolder}
            aria-label={t("library.newFolder")}
          >
            {t("library.newFolder")}
          </Button>
        )}
      </div>
    </div>
  );
}
