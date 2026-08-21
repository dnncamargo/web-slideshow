"use client";

import { Status } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { PresentationSummary } from "../persistence/presentation-persistence";
import type { PresentationFolder } from "../persistence/presentation-folder";
import type { LiveState } from "../control/live-current";

import {
  isLivePresentation,
  publicationStatusTone,
  resolveFolderName,
} from "./presentation-library-logic";
import { formatPresentationDate } from "./presentation-dates";
import styles from "./presentation-library.module.css";

interface PresentationDetailsProps {
  summary: PresentationSummary | null;
  liveState: LiveState;
  folders: readonly PresentationFolder[];
  movingId: string | null;
  onMoveFolder: (folderId: string | null) => void;
}

/**
 * Stationary right-side Details pane for the Studio presentation workspace.
 *
 * Shows only data already available on the PresentationSummary plus the
 * loaded folder list: title, publication status, draft revision, timestamps
 * (when safely resolvable), the published revision, the folder assignment,
 * and the Live indication. It never calls repository.getPresentation, never
 * loads the canonical document, and never exposes internal publication/version
 * IDs or the raw folderId.
 */
export function PresentationDetails({
  summary,
  liveState,
  folders,
  movingId,
  onMoveFolder,
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
  const archivedAt = summary.archived
    ? formatPresentationDate(summary.archivedAt, locale)
    : null;
  const unpublishedDelta =
    summary.publicationState === "unpublished-changes" && publication
      ? summary.draftRevision - publication.publishedRevision
      : 0;

  const folderName = (folderId: string | null): string => {
    if (!folderId) {
      return t("library.noFolder");
    }

    return resolveFolderName(folders, folderId) ?? t("library.folderFallback");
  };

  const missingFolderId: string | null =
    summary.folderId !== null &&
    !folders.some((folder) => folder.id === summary.folderId)
      ? summary.folderId
      : null;

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

        <div className={styles.detailsRow}>
          <dt>{t("library.details.folder")}</dt>
          <dd>
            {summary.archived ? (
              <span>{folderName(summary.folderId)}</span>
            ) : (
              <select
                className={styles.folderSelect}
                aria-label={t("library.details.folder")}
                value={summary.folderId ?? ""}
                disabled={movingId !== null}
                onChange={(event) => {
                  const value = event.target.value;
                  onMoveFolder(value === "" ? null : value);
                }}
              >
                <option value="">{t("library.noFolder")}</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
                {missingFolderId !== null ? (
                  <option value={missingFolderId}>
                    {t("library.folderFallback")}
                  </option>
                ) : null}
              </select>
            )}
          </dd>
        </div>

        {summary.archived && archivedAt ? (
          <div className={styles.detailsRow}>
            <dt>{t("library.details.archivedAt")}</dt>
            <dd>{archivedAt}</dd>
          </div>
        ) : null}

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
