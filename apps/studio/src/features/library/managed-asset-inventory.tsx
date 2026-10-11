"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@web-slideshow/ui";

import { useStudioAuth } from "../auth/studio-auth-provider";
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

export function ManagedAssetInventory() {
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
  }, [loadFirstPage]);

  const loadNextPage = () => {
    if (loadingMore || !hasMore || cursor === null) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    void fetchPage(cursor, true, requestRef.current);
  };

  const selectedItem = items.find((item) => item.pathname === selectedPathname) ?? null;

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
            {items.map((item) => (
              <div className={`${styles.row} ${styles.storageRow}`} key={item.pathname} data-storage-object={item.pathname} data-selected={selectedPathname === item.pathname}>
                <button
                  type="button"
                  className={styles.storageSelect}
                  data-storage-select
                  data-selected={selectedPathname === item.pathname}
                  aria-pressed={selectedPathname === item.pathname}
                  onClick={() => setSelectedPathname(item.pathname)}
                >
                  <span className={styles.rowDetails}>
                    <span className={styles.rowTitle}>{item.pathname}</span>
                    <span className={styles.rowMetadata}>
                      <span>{formatBytes(item.size, locale)}</span>
                      <span>{formatUploadedAt(item.uploadedAt, locale)}</span>
                    </span>
                  </span>
                </button>
                <Button size="compact" onClick={() => void copyPathname(item.pathname)}>
                  {copiedPathname === item.pathname ? t("library.storage.copied") : t("library.storage.copyId")}
                </Button>
              </div>
            ))}
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

      <aside className={styles.detailsPane} aria-label={t("library.details")} data-storage-details>
        {selectedItem ? (
          <>
            <h2 className={styles.detailsHeading}>{t("library.storage.objectDetails")}</h2>
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
      </aside>
    </>
  );
}
