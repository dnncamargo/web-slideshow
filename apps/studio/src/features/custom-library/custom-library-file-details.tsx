"use client";

import { useState } from "react";

import { Button } from "@web-slideshow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import styles from "../library/presentation-library.module.css";
import {
  formatCustomLibraryFileSize,
  type CustomLibraryFileRecord,
} from "./custom-library-file";

interface PhysicalObjectMetadata {
  pathname: string;
  size: number;
  uploadedAt: string;
  url: string;
  etag: string;
}

interface CustomLibraryFileDetailsProps {
  record: CustomLibraryFileRecord | null;
  physicalObject?: PhysicalObjectMetadata;
  pending?: boolean;
  renamePending?: boolean;
  renameError?: string | null;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function CustomLibraryFileDetails({
  record,
  physicalObject,
  pending = false,
  renamePending = false,
  renameError = null,
  onRename,
  onDelete,
}: CustomLibraryFileDetailsProps) {
  const { locale, t } = useStudioI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(record?.file.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  if (!record) {
    return (
      <aside className={styles.detailsPane} aria-label={t("library.details")}>
        <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
        <p className={styles.detailsEmpty}>{t("customLibrary.fileDetails.noSelection")}</p>
      </aside>
    );
  }

  const saveName = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t("customLibrary.fileDetails.nameRequired"));
      return;
    }

    setNameError(null);
    onRename(trimmedName);
  };

  return (
    <aside className={styles.detailsPane} aria-label={t("library.details")}>
      <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
      <dl className={styles.detailsList}>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.fileDetails.name")}</dt>
          <dd>
            {editing ? (
              <input
                className={styles.customLibraryFileRenameInput}
                type="text"
                value={name}
                aria-label={t("customLibrary.fileDetails.name")}
                disabled={renamePending}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveName();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setEditing(false);
                    setName(record.file.name);
                    setNameError(null);
                  }
                }}
              />
            ) : (
              record.file.name
            )}
          </dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.fileDetails.type")}</dt>
          <dd>{t(`customLibrary.file.kind.${record.file.kind}`)}</dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.fileDetails.mimeType")}</dt>
          <dd>{record.file.source.contentType}</dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.fileDetails.size")}</dt>
          <dd>{formatCustomLibraryFileSize(record.file.source.sizeBytes)}</dd>
        </div>
        {physicalObject ? (
          <>
            <div className={styles.detailsRow}>
              <dt>{t("library.storage.identifier")}</dt>
              <dd className={styles.storageIdentifier}>{physicalObject.pathname}</dd>
            </div>
            <div className={styles.detailsRow}>
              <dt>{t("library.storage.size")}</dt>
              <dd>{formatCustomLibraryFileSize(physicalObject.size)}</dd>
            </div>
            <div className={styles.detailsRow}>
              <dt>{t("library.storage.uploadedAt")}</dt>
              <dd>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(physicalObject.uploadedAt))}</dd>
            </div>
            <div className={styles.detailsRow}>
              <dt>{t("library.storage.url")}</dt>
              <dd className={styles.storageIdentifier}><a href={physicalObject.url} target="_blank" rel="noreferrer">{physicalObject.url}</a></dd>
            </div>
            <div className={styles.detailsRow}>
              <dt>{t("library.storage.etag")}</dt>
              <dd className={styles.storageIdentifier}>{physicalObject.etag}</dd>
            </div>
          </>
        ) : null}
      </dl>

      {nameError || renameError ? (
        <p className={styles.customLibraryFileRenameError} role="alert">
          {nameError ?? renameError}
        </p>
      ) : null}

      <div className={styles.paletteDetailsActions}>
        {editing ? (
          <>
            <Button
              variant="primary"
              size="compact"
              disabled={renamePending}
              onClick={saveName}
            >
              {renamePending ? t("customLibrary.fileDetails.saving") : t("customLibrary.fileDetails.save")}
            </Button>
            <Button
              size="compact"
              disabled={renamePending}
              onClick={() => {
                setEditing(false);
                setName(record.file.name);
                setNameError(null);
              }}
            >
              {t("customLibrary.fileDetails.cancel")}
            </Button>
          </>
        ) : (
          <Button
            size="compact"
            disabled={pending}
            onClick={() => {
              setName(record.file.name);
              setNameError(null);
              setEditing(true);
            }}
          >
            {t("customLibrary.fileDetails.rename")}
          </Button>
        )}
        <Button variant="danger" size="compact" disabled={pending || renamePending} onClick={onDelete}>
          {t("customLibrary.fileDetails.delete")}
        </Button>
      </div>
    </aside>
  );
}
