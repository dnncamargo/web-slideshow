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
  onNew: () => void;
  onEdit: (id: string) => void;
  onPresent: (summary: PresentationSummary) => void;
  onControl: () => void;
  onEnd: () => void;
  onArchive: (id: string) => void;
}

/**
 * Management toolbar with a three-zone grid:
 *
 * - LEFT:   intentionally empty / breathing space.
 * - CENTER: selected presentation context (title immediately before a subtle
 *           Separator, then the contextual action buttons). Empty when
 *           nothing is selected.
 * - RIGHT:  global management actions (New, Import/Export transfer slot,
 *           New folder), right-aligned.
 *
 * The outer tracks are symmetric so the selected context is geometrically
 * centered rather than merely appended after the global actions.
 */
export function PresentationToolbar({
  selected,
  liveState,
  creating,
  openingId,
  archivingId,
  onNew,
  onEdit,
  onPresent,
  onControl,
  onEnd,
  onArchive,
}: PresentationToolbarProps) {
  const { t } = useStudioI18n();
  const state = resolvePresentationToolbarState(selected, liveState);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={t("library.actions")}>
      <span className={styles.toolbarLeft} aria-hidden="true" />

      {/* ====================================================
          CENTER: selected presentation context
          ==================================================== */}
      <div className={styles.toolbarCenter}>
        {state.mode !== "none" && selected ? (
          <span className={styles.toolbarContext} role="group" aria-label={selected.title}>
            <span className={styles.toolbarSelection} title={selected.title}>
              {selected.title || t("library.untitled")}
            </span>

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
            disabled
            title={t("library.importUnavailable")}
            aria-label={t("library.importUnavailable")}
          >
            {t("library.import")}
          </Button>
        ) : (
          <Button
            size="compact"
            disabled
            title={t("library.exportUnavailable")}
            aria-label={t("library.exportUnavailable")}
          >
            {t("library.export")}
          </Button>
        )}

        {/* GLOBAL: New folder is always visible but disabled. */}
        <Button
          size="compact"
          disabled
          title={t("library.newFolderUnavailable")}
          aria-label={t("library.newFolderUnavailable")}
        >
          {t("library.newFolder")}
        </Button>
      </div>
    </div>
  );
}