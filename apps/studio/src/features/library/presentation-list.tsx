"use client";

import { Status } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { PresentationSummary } from "../persistence/presentation-persistence";
import type { LiveState } from "../control/live-current";

import { isLivePresentation, publicationStatusTone } from "./presentation-library-logic";
import { PresentationThumbnail } from "./presentation-thumbnail";
import styles from "./presentation-library.module.css";

interface PresentationListProps {
  summaries: readonly PresentationSummary[];
  selectedId: string | null;
  liveState: LiveState;
  openingId: string | null;
  onSelect: (id: string) => void;
}

export function PresentationList({
  summaries,
  selectedId,
  liveState,
  openingId,
  onSelect,
}: PresentationListProps) {
  const { t } = useStudioI18n();

  return (
    <ul className={styles.list} aria-label={t("library.presentations")}>
      {summaries.map((summary) => {
        const title = summary.title || t("library.untitled");
        const selected = selectedId === summary.id;
        const live = isLivePresentation(summary, liveState);

        return (
          <li key={summary.id}>
            <button
              type="button"
              className={styles.row}
              data-presentation-row
              data-selected={selected}
              aria-pressed={selected}
              aria-busy={openingId === summary.id}
              aria-label={t("library.selectPresentation", { title })}
              onClick={() => onSelect(summary.id)}
            >
              <PresentationThumbnail summary={summary} />

              <span className={styles.rowDetails}>
                <strong className={styles.rowTitle}>{title}</strong>
                <span className={styles.rowMetadata}>
                  <Status tone={publicationStatusTone(summary)}>
                    {t(`library.status.${summary.publicationState}`)}
                  </Status>
                  <span>{t("library.revision", { number: summary.draftRevision })}</span>
                </span>
              </span>

              <span className={styles.rowState}>
                {live ? <Status tone="success">{t("library.live")}</Status> : null}
                {openingId === summary.id ? (
                  <span className={styles.rowOpening}>{t("library.opening")}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
