"use client";

import { Status } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { PresentationSummary } from "../persistence/presentation-persistence";
import type { LiveState } from "../control/live-current";

import {
  isLivePresentation,
  publicationStatusTone,
} from "./presentation-library-logic";
import { formatPresentationDate } from "./presentation-dates";
import styles from "./presentation-library.module.css";

interface PresentationDetailsProps {
  summary: PresentationSummary | null;
  liveState: LiveState;
}

/**
 * Stationary right-side Details pane for the Studio presentation workspace.
 *
 * Shows only data already available on the PresentationSummary: title,
 * publication status, draft revision, last-updated and published timestamps
 * (when safely resolvable), the published revision, and the Live indication.
 * It never calls repository.getPresentation, never loads the canonical
 * document, and never exposes internal publication/version IDs.
 */
export function PresentationDetails({
  summary,
  liveState,
}: PresentationDetailsProps) {
  const { locale, t } = useStudioI18n();

  if (!summary) {
    return (
      <aside className={styles.detailsPane} aria-label={t("library.details")}>
        <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
        <p className={styles.detailsEmpty}>{t("library.details.empty")}</p>
      </aside>
    );
  }

  const live = isLivePresentation(summary, liveState);
  const publication = summary.publication;
  const lastUpdated = formatPresentationDate(summary.updatedAt, locale);
  const publishedAt = publication
    ? formatPresentationDate(publication.publishedAt, locale)
    : null;
  const unpublishedDelta =
    summary.publicationState === "unpublished-changes" && publication
      ? summary.draftRevision - publication.publishedRevision
      : 0;

  return (
    <aside className={styles.detailsPane} aria-label={t("library.details")}>
      <h2 className={styles.detailsHeading}>{t("library.details")}</h2>

      <dl className={styles.detailsList}>
        <div className={styles.detailsRow}>
          <dt>{t("library.details.title")}</dt>
          <dd>{summary.title || t("library.untitled")}</dd>
        </div>

        <div className={styles.detailsRow}>
          <dt>{t("library.details.status")}</dt>
          <dd>
            <Status tone={publicationStatusTone(summary)}>
              {t(`library.status.${summary.publicationState}`)}
            </Status>
          </dd>
        </div>

        <div className={styles.detailsRow}>
          <dt>{t("library.details.revision")}</dt>
          <dd>{summary.draftRevision}</dd>
        </div>

        {lastUpdated ? (
          <div className={styles.detailsRow}>
            <dt>{t("library.details.lastUpdated")}</dt>
            <dd>{lastUpdated}</dd>
          </div>
        ) : null}

        {publication ? (
          <div className={styles.detailsRow}>
            <dt>{t("library.details.publishedRevision")}</dt>
            <dd>{publication.publishedRevision}</dd>
          </div>
        ) : null}

        {publishedAt ? (
          <div className={styles.detailsRow}>
            <dt>{t("library.details.publishedAt")}</dt>
            <dd>{publishedAt}</dd>
          </div>
        ) : null}

        {unpublishedDelta > 0 ? (
          <div className={styles.detailsRow}>
            <dt>{t("library.details.unpublishedDelta")}</dt>
            <dd>{unpublishedDelta}</dd>
          </div>
        ) : null}
      </dl>

      {live ? (
        <p className={styles.detailsLive}>
          <Status tone="success">{t("library.live")}</Status>
        </p>
      ) : null}
    </aside>
  );
}