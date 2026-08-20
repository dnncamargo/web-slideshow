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
      {state.actions.includes("new") ? (
        <Button
          variant="primary"
          size="compact"
          disabled={creating}
          onClick={onNew}
          aria-label={t("library.new")}
        >
          {creating ? t("library.creating") : t("library.new")}
        </Button>
      ) : null}

      {state.actions.includes("new-folder") ? (
        <Button
          size="compact"
          disabled
          title={t("library.newFolderUnavailable")}
          aria-label={t("library.newFolderUnavailable")}
        >
          {t("library.newFolder")}
        </Button>
      ) : null}

      {state.mode !== "none" ? (
        <span className={styles.toolbarSelection} title={selected?.title}>
          {selected?.title || t("library.untitled")}
        </span>
      ) : null}

      {state.mode !== "none" ? <Separator /> : null}

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
    </div>
  );
}
