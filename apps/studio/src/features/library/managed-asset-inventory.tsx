"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@web-slideshow/ui";

import { useStudioAuth } from "../auth/studio-auth-provider";
import type { CustomLibraryFileRecord } from "../custom-library/custom-library-file";
import { classifySupportedFileName } from "../custom-library/custom-library-file-classification";
import { CustomLibraryFileDetails } from "../custom-library/custom-library-file-details";
import { useStudioI18n } from "../i18n/studio-i18n-context";
import styles from "./presentation-library.module.css";

const MAX_CURSOR_LENGTH = 4096;

interface InventoryItem {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
  etag: string;
}

interface InventoryPage {
  scope: "owner";
  items: InventoryItem[];
  hasMore: boolean;
  cursor?: string;
}

type InventoryStatus = "loading" | "ready" | "error";
type FileMetadataStatus = "idle" | "loading" | "ready" | "error";

interface ManagedAssetInventoryProps {
  files: readonly CustomLibraryFileRecord[];
  filesStatus: FileMetadataStatus;
  selectedFileId: string | null;
  fileMutationPending: boolean;
  renamePending: boolean;
  renameError: string | null;
  refreshKey: number;
  onSelectFile: (id: string | null) => void;
  onRenameFile: (name: string) => void;
  onDeleteFile: () => void;
}

function isInventoryPage(value: unknown, uid: string): value is InventoryPage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    record.scope !== "owner" ||
    !Array.isArray(record.items) ||
    typeof record.hasMore !== "boolean"
  ) return false;

  for (const valueItem of record.items) {
    if (typeof valueItem !== "object" || valueItem === null) return false;
    const item = valueItem as Record<string, unknown>;
    let url: URL;
    try {
      url = new URL(typeof item.url === "string" ? item.url : "");
    } catch {
      return false;
    }
    if (
      typeof item.pathname !== "string" ||
      !item.pathname.startsWith(`users/${uid}/assets/`) ||
      item.pathname.length <= `users/${uid}/assets/`.length ||
      item.pathname.length > 2048 ||
      typeof item.url !== "string" ||
      item.url.length === 0 ||
      item.url.length > 4096 ||
      url.protocol !== "https:" ||
      Boolean(url.username || url.password) ||
      typeof item.size !== "number" ||
      !Number.isSafeInteger(item.size) ||
      item.size < 0 ||
      typeof item.uploadedAt !== "string" ||
      !Number.isFinite(Date.parse(item.uploadedAt)) ||
      typeof item.etag !== "string" ||
      item.etag.length === 0 ||
      item.etag.length > 512
    ) return false;
  }

  if (record.hasMore) {
    return typeof record.cursor === "string" &&
      record.cursor.length > 0 &&
      record.cursor.length <= MAX_CURSOR_LENGTH;
  }
  return record.cursor === undefined;
}

function formatBytes(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}

function formatUploadedAt(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value));
}

export function ManagedAssetInventory({
  files,
  filesStatus,
  selectedFileId,
  fileMutationPending,
  renamePending,
  renameError,
  refreshKey,
  onSelectFile,
  onRenameFile,
  onDeleteFile,
}: ManagedAssetInventoryProps) {
  const { user } = useStudioAuth();
  const { locale, t } = useStudioI18n();
  const [status, setStatus] = useState<InventoryStatus>("loading");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedPathname, setSelectedPathname] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [copiedPathname, setCopiedPathname] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const requestRef = useRef(0);
  const seenCursorsRef = useRef(new Set<string>());
  const seenPathnamesRef = useRef(new Set<string>());
  const activeUserRef = useRef(user);
  const ownerId = user?.uid ?? null;
  const filesByStoragePath = useMemo(() => {
    const recordsByPath = new Map<string, CustomLibraryFileRecord[]>();
    for (const record of files) {
      const current = recordsByPath.get(record.file.source.storagePath);
      if (current) current.push(record);
      else recordsByPath.set(record.file.source.storagePath, [record]);
    }
    return recordsByPath;
  }, [files]);

  useEffect(() => {
    activeUserRef.current = user;
  }, [user]);

  const fetchPage = useCallback(async (
    nextCursor: string | null,
    append: boolean,
    requestId: number,
  ) => {
    const activeUser = activeUserRef.current;
    if (!activeUser || !ownerId) {
      setStatus("error");
      setLoadingMore(false);
      return;
    }

    try {
      const token = await activeUser.getIdToken();
      const query = nextCursor === null ? "" : `?cursor=${encodeURIComponent(nextCursor)}`;
      const response = await fetch(`/api/managed-assets/inventory${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("inventory unavailable");
      const body: unknown = await response.json();
      if (!isInventoryPage(body, ownerId)) throw new Error("invalid inventory response");
      if (requestRef.current !== requestId) return;

      if (body.hasMore && body.cursor && seenCursorsRef.current.has(body.cursor)) {
        throw new Error("repeated inventory cursor");
      }
      const pagePathnames = new Set<string>();
      for (const item of body.items) {
        if (seenPathnamesRef.current.has(item.pathname) || pagePathnames.has(item.pathname)) {
          throw new Error("repeated inventory item");
        }
        pagePathnames.add(item.pathname);
      }
      if (body.hasMore && body.cursor) seenCursorsRef.current.add(body.cursor);
      for (const pathname of pagePathnames) seenPathnamesRef.current.add(pathname);

      setItems((current) => append ? [...current, ...body.items] : body.items);
      setCursor(body.cursor ?? null);
      setHasMore(body.hasMore);
      setStatus("ready");
      setLoadMoreError(false);
    } catch {
      if (requestRef.current !== requestId) return;
      if (append) setLoadMoreError(true);
      else setStatus("error");
    } finally {
      if (requestRef.current === requestId) setLoadingMore(false);
    }
  }, [ownerId]);

  const loadFirstPage = useCallback(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    seenCursorsRef.current.clear();
    seenPathnamesRef.current.clear();
    setItems([]);
    setSelectedPathname(null);
    setCursor(null);
    setHasMore(false);
    setLoadingMore(false);
    setLoadMoreError(false);
    setStatus("loading");
    void fetchPage(null, false, requestId);
  }, [fetchPage]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) loadFirstPage();
    });
    return () => {
      active = false;
      requestRef.current += 1;
    };
  }, [loadFirstPage, refreshKey]);

  const loadNextPage = () => {
    if (loadingMore || !hasMore || cursor === null) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    void fetchPage(cursor, true, requestRef.current);
  };

  const selectedItem = items.find((item) => item.pathname === selectedPathname) ?? null;
  const selectedFileMatches = selectedItem
    ? filesByStoragePath.get(selectedItem.pathname) ?? []
    : [];
  const selectedFile = selectedFileMatches.length === 1 &&
      selectedFileMatches[0]?.id === selectedFileId
    ? selectedFileMatches[0]
    : null;

  const copyPathname = async (pathname: string) => {
    setCopiedPathname(null);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(pathname);
      setCopiedPathname(pathname);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <>
      <section className={styles.browserPane} aria-live="polite" data-storage-inventory>
        {status === "loading" ? <p className={styles.stateBlock}>{t("library.storage.loading")}</p> : null}
        {status === "error" ? (
          <div className={styles.stateBlock}>
            <p>{t("library.storage.loadFailed")}</p>
            <Button size="compact" onClick={loadFirstPage}>{t("library.retry")}</Button>
          </div>
        ) : null}
        {status === "ready" && items.length === 0 ? <p className={styles.stateBlock}>{t("library.storage.empty")}</p> : null}
        {items.length > 0 ? (
          <div className={styles.list}>
            {items.map((item) => {
              const matchingFiles = filesByStoragePath.get(item.pathname) ?? [];
              const fileRecord = matchingFiles.length === 1 ? matchingFiles[0] : null;
              const classification = fileRecord
                ? classifySupportedFileName(fileRecord.file.name)
                : null;

              return (
              <div className={`${styles.row} ${styles.storageRow}`} key={item.pathname} data-storage-object={item.pathname} data-selected={selectedPathname === item.pathname}>
                <button
                  type="button"
                  className={styles.storageSelect}
                  data-storage-select
                  data-custom-library-file-row={fileRecord ? fileRecord.id : undefined}
                  data-file-associated={fileRecord !== null}
                  data-selected={selectedPathname === item.pathname}
                  aria-pressed={selectedPathname === item.pathname}
                  onClick={() => {
                    setSelectedPathname(item.pathname);
                    onSelectFile(fileRecord?.id ?? null);
                  }}
                >
                  {fileRecord ? (
                    <span className={styles.customLibraryFilePreview} aria-hidden="true">
                      <span className={styles.customLibraryFilePreviewGlyph}>
                        {classification?.extension.slice(1).toUpperCase() ?? fileRecord.file.kind.slice(0, 3).toUpperCase()}
                      </span>
                    </span>
                  ) : null}
                  <span className={styles.rowDetails}>
                    <span className={styles.rowTitle}>{item.pathname}</span>
                    <span className={styles.rowMetadata}>
                      <span>{formatBytes(item.size, locale)}</span>
                      <span>{formatUploadedAt(item.uploadedAt, locale)}</span>
                      {fileRecord ? (
                        <>
                          <span>{fileRecord.file.name}</span>
                          <span>{t(`customLibrary.file.kind.${fileRecord.file.kind}`)}</span>
                        </>
                      ) : (
                        <span>
                          {matchingFiles.length > 1
                            ? t("library.storage.fileAssociationConflict")
                            : filesStatus === "ready"
                              ? t("library.storage.libraryMetadataUnavailable")
                              : filesStatus === "error"
                                ? t("library.storage.libraryMetadataFailed")
                                : t("library.storage.libraryMetadataLoading")}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <Button size="compact" onClick={() => void copyPathname(item.pathname)}>
                  {copiedPathname === item.pathname ? t("library.storage.copied") : t("library.storage.copyId")}
                </Button>
              </div>
              );
            })}
          </div>
        ) : null}
        {status === "ready" && hasMore ? (
          <div className={styles.storagePagination}>
            {loadMoreError ? <p role="alert">{t("library.storage.loadMoreFailed")}</p> : null}
            <Button size="compact" disabled={loadingMore} onClick={loadNextPage}>
              {loadingMore ? t("library.storage.loadingMore") : t("library.storage.loadMore")}
            </Button>
          </div>
        ) : null}
        {copyFailed ? <p className={styles.storageCopyError} role="alert">{t("library.storage.copyFailed")}</p> : null}
      </section>

      {selectedFile && selectedItem ? (
        <CustomLibraryFileDetails
          key={`${selectedFile.id}:${selectedFile.file.name}`}
          record={selectedFile}
          pending={fileMutationPending}
          renamePending={renamePending}
          renameError={renameError}
          physicalObject={selectedItem}
          onRename={onRenameFile}
          onDelete={onDeleteFile}
        />
      ) : <aside className={styles.detailsPane} aria-label={t("library.details")} data-storage-details>
        {selectedItem ? (
          <>
            <h2 className={styles.detailsHeading}>{t("library.storage.objectDetails")}</h2>
            {selectedFileMatches.length > 1 ? (
              <p role="status">{t("library.storage.fileAssociationConflict")}</p>
            ) : filesStatus === "ready" ? (
              <p>{t("library.storage.libraryMetadataUnavailable")}</p>
            ) : filesStatus === "error" ? (
              <p>{t("library.storage.libraryMetadataFailed")}</p>
            ) : (
              <p>{t("library.storage.libraryMetadataLoading")}</p>
            )}
            <dl className={styles.detailsList}>
              <div className={styles.detailsRow}>
                <dt>{t("library.storage.identifier")}</dt>
                <dd className={styles.storageIdentifier}>{selectedItem.pathname}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>{t("library.storage.size")}</dt>
                <dd>{formatBytes(selectedItem.size, locale)}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>{t("library.storage.uploadedAt")}</dt>
                <dd>{formatUploadedAt(selectedItem.uploadedAt, locale)}</dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>{t("library.storage.url")}</dt>
                <dd className={styles.storageIdentifier}><a href={selectedItem.url} target="_blank" rel="noreferrer">{selectedItem.url}</a></dd>
              </div>
              <div className={styles.detailsRow}>
                <dt>{t("library.storage.etag")}</dt>
                <dd className={styles.storageIdentifier}>{selectedItem.etag}</dd>
              </div>
            </dl>
            <Button size="compact" onClick={() => void copyPathname(selectedItem.pathname)}>
              {copiedPathname === selectedItem.pathname ? t("library.storage.copied") : t("library.storage.copyIdentifier")}
            </Button>
          </>
        ) : (
          <p className={styles.detailsEmpty}>{t("library.storage.selectObject")}</p>
        )}
      </aside>}
    </>
  );
}
