"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@web-slideshow/ui";

import { DangerConfirmDialog } from "../app/danger-confirm-dialog";
import { useStudioAuth } from "../auth/studio-auth-provider";
import type { CustomLibraryFileRecord } from "../custom-library/custom-library-file";
import type { CustomLibraryFontRecord } from "../custom-library/custom-library-font";
import { customLibraryFileAvailabilityPath, managedFontFaceAvailabilityPath } from "../custom-library/managed-asset-availability-path";
import { ManagedAssetAvailabilityControl } from "../custom-library/managed-asset-availability-control";
import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { StudioMessageKey } from "../i18n/studio-i18n";
import {
  classifyManagedAssetExtension,
  MANAGED_ASSET_EXTENSIONS,
  type ManagedAssetCategory,
} from "../persistence/managed-asset-content-types";
import { listManagedAssetUploadIntents } from "../persistence/managed-asset-storage";
import type { ManagedAssetUploadIntent } from "../persistence/managed-asset-storage";
import { isManagedAssetControlPath } from "../persistence/managed-asset-control-path";
import { StorageUsageIndicator } from "./storage-usage-indicator";
import styles from "./presentation-library.module.css";

interface InventoryItem {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
  etag: string;
  contentType?: string;
  displayName?: string;
}

interface InventoryPage {
  scope: "owner";
  items: InventoryItem[];
  hasMore: boolean;
  cursor?: string;
}

type Category = "images" | "audio" | "fonts" | "text" | "structured-data" | "other";
type SortOrder = "date-desc" | "date-asc" | "type";
interface SelectedMetadata { contentType: string; size: number }
interface LibraryManagedAssetCandidate { pathname: string; label: string; associations: string[] }

function libraryManagedAssetCandidates(
  files: readonly CustomLibraryFileRecord[],
  fonts: readonly CustomLibraryFontRecord[],
): LibraryManagedAssetCandidate[] {
  const candidates = new Map<string, LibraryManagedAssetCandidate>();
  const add = (pathname: string | null, label: string, association: string) => {
    if (!pathname) return;
    const candidate = candidates.get(pathname) ?? { pathname, label, associations: [] };
    if (!candidate.associations.includes(association)) candidate.associations.push(association);
    candidates.set(pathname, candidate);
  };

  files.forEach((record) => add(
    customLibraryFileAvailabilityPath(record),
    record.file.name,
    `${record.file.name} (File)`,
  ));
  fonts.forEach((record) => record.font.faces.forEach((face) => {
    const faceDescriptor = [face.weight, face.style, face.source.format?.toUpperCase()]
      .filter((value) => value !== undefined)
      .join(" · ");
    const label = faceDescriptor ? `${record.font.family} · ${faceDescriptor}` : record.font.family;
    add(managedFontFaceAvailabilityPath(face), label, `${label} (Font face)`);
  }));

  return [...candidates.values()].sort((left, right) => left.label.localeCompare(right.label));
}
const CURSOR_LIMIT = 4096;
const PREVIEW_LIMIT = 512 * 1024;

function classifyContentType(contentType: string): ManagedAssetCategory | null {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  for (const classification of Object.values(MANAGED_ASSET_EXTENSIONS)) {
    if (classification.contentType === normalized) return classification.category;
  }
  return null;
}

function normalizedContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function categoryFor(item: InventoryItem, contentType?: string): Category {
  return categoryForPath(item.pathname, contentType);
}

function categoryForPath(pathname: string, contentType?: string): Category {
  const dot = pathname.lastIndexOf("/");
  const filename = pathname.slice(dot + 1);
  const extensionClass = classifyManagedAssetExtension(`.${filename.split(".").at(-1)}`);
  const category = classifyContentType(contentType ?? "") ?? extensionClass?.category ?? null;
  if (category === "image") return "images";
  if (category === "audio") return "audio";
  if (category === "font") return "fonts";
  if (category === "text" || category === "markdown") return "text";
  if (category === "structured-data") return "structured-data";
  return "other";
}

function knownContentType(item: InventoryItem, intents: readonly ManagedAssetUploadIntent[], files: readonly CustomLibraryFileRecord[], fonts: readonly CustomLibraryFontRecord[]): string | undefined {
  if (item.contentType) return item.contentType;
  const intent = intents.find((entry) => entry.storagePath === item.pathname && entry.state === "complete");
  if (intent) return intent.contentType;
  const file = files.find((entry) => entry.file.source.storagePath === item.pathname);
  if (file) return file.file.source.contentType;
  const face = fonts.flatMap((entry) => entry.font.faces).find((candidate) => {
    try { return new URL(candidate.source.url).pathname.replace(/^\/+/, "") === item.pathname; } catch { return false; }
  });
  switch (face?.source.format) {
    case "truetype": return "font/ttf";
    case "opentype": return "font/otf";
    case "woff": return "font/woff";
    case "woff2": return "font/woff2";
    default: return undefined;
  }
}

function extensionFor(item: InventoryItem): string | null {
  const last = item.pathname.slice(item.pathname.lastIndexOf("/") + 1);
  const match = /\.[a-z0-9]+$/i.exec(last);
  const extension = match?.[0]?.toLowerCase();
  return extension && classifyManagedAssetExtension(extension) ? extension : null;
}

function shortId(item: InventoryItem): string {
  const basename = item.pathname.slice(item.pathname.lastIndexOf("/") + 1);
  const withoutExtension = basename.replace(/\.[a-z0-9]+$/i, "");
  return withoutExtension.length > 18 ? `${withoutExtension.slice(0, 8)}…${withoutExtension.slice(-6)}` : withoutExtension;
}

function physicalIdentifier(item: InventoryItem): string {
  const basename = item.pathname.slice(item.pathname.lastIndexOf("/") + 1);
  return basename.replace(/\.[a-z0-9]+$/i, "");
}

function isInventoryPage(value: unknown, uid: string): value is InventoryPage {
  if (typeof value !== "object" || value === null) return false;
  const page = value as Record<string, unknown>;
  if (page.scope !== "owner" || !Array.isArray(page.items) || typeof page.hasMore !== "boolean") return false;
  const prefix = `users/${uid}/assets/`;
  for (const raw of page.items) {
    if (typeof raw !== "object" || raw === null) return false;
    const item = raw as Record<string, unknown>;
    let url: URL;
    try { url = new URL(typeof item.url === "string" ? item.url : ""); } catch { return false; }
    if (
      typeof item.pathname !== "string" || !item.pathname.startsWith(prefix) || item.pathname.length > 2048 ||
      typeof item.url !== "string" || item.url.length === 0 || item.url.length > 4096 || url.protocol !== "https:" || url.username || url.password ||
      typeof item.size !== "number" || !Number.isSafeInteger(item.size) || item.size < 0 ||
      typeof item.uploadedAt !== "string" || !Number.isFinite(Date.parse(item.uploadedAt)) ||
      typeof item.etag !== "string" || item.etag.length === 0 || item.etag.length > 512 ||
      (item.displayName !== undefined && (typeof item.displayName !== "string" || item.displayName.trim() !== item.displayName
        || !item.displayName || Array.from(item.displayName).length > 512 || /[\\/\p{Cc}]/u.test(item.displayName)))
    ) return false;
  }
  return page.hasMore
    ? typeof page.cursor === "string" && page.cursor.length > 0 && page.cursor.length <= CURSOR_LIMIT
    : page.cursor === undefined;
}

function formatBytes(size: number, locale: string): string {
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[index]}`;
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) throw new Error("Preview body is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let result = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new Error("Preview exceeds the size limit.");
      }
      result += decoder.decode(chunk.value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function logicalName(item: InventoryItem, intents: readonly ManagedAssetUploadIntent[], files: readonly CustomLibraryFileRecord[], fonts: readonly CustomLibraryFontRecord[]): string | null {
  if (item.displayName) return item.displayName;
  const intent = intents.find((entry) => entry.storagePath === item.pathname && entry.state === "complete");
  if (intent) return intent.originalFilename;
  const file = files.find((entry) => entry.file.source.storagePath === item.pathname);
  if (file) return file.file.name;
  const font = fonts.find((entry) => entry.font.faces.some((face) => {
    try { return new URL(face.source.url).pathname.replace(/^\/+/, "") === item.pathname; } catch { return false; }
  }));
  return font?.font.family ?? null;
}

function categoryLabel(category: Category, t: (key: StudioMessageKey) => string): string {
  return t(`library.storage.category.${category}` as StudioMessageKey);
}

export interface StorageManagerProps {
  files: readonly CustomLibraryFileRecord[];
  fonts: readonly CustomLibraryFontRecord[];
  uploading: boolean;
  uploadError: string | null;
  usageRefreshKey: number;
  focusPathname: string | null;
  onFocusResolved: (pathname: string) => void;
  onPhysicalDelete: () => void;
}

export function StorageManager({ files, fonts, uploading, uploadError, usageRefreshKey, focusPathname, onFocusResolved, onPhysicalDelete }: StorageManagerProps) {
  const { user } = useStudioAuth();
  const { locale, t } = useStudioI18n();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [focusedItem, setFocusedItem] = useState<InventoryItem | null>(null);
  const [focusError, setFocusError] = useState(false);
  const [focusAnnotationError, setFocusAnnotationError] = useState(false);
  const [intents, setIntents] = useState<ManagedAssetUploadIntent[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SelectedMetadata | null>(null);
  const [metadataError, setMetadataError] = useState(false);
  const [metadataAnnotationError, setMetadataAnnotationError] = useState(false);
  const [protectionState, setProtectionState] = useState<"active" | "deleting" | "delete_failed" | "deleted">("active");
  const [isProtected, setIsProtected] = useState(false);
  const [protectionLoading, setProtectionLoading] = useState(false);
  const [protectionBusy, setProtectionBusy] = useState(false);
  const [protectionError, setProtectionError] = useState(false);
  const [deleteRetryAvailable, setDeleteRetryAvailable] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<SortOrder>("date-desc");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [copied, setCopied] = useState<"id" | "url" | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [editingPathname, setEditingPathname] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<"required" | "invalid" | "failed" | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const requestRef = useRef(0);
  const userRef = useRef(user);
  const selectedPathRef = useRef<string | null>(null);
  const pathnamesRef = useRef(new Set<string>());
  const cursorSetRef = useRef(new Set<string>());
  const ownerId = user?.uid ?? null;
  const libraryAssets = useMemo(() => libraryManagedAssetCandidates(files, fonts), [files, fonts]);

  useEffect(() => { userRef.current = user; }, [user]);

  const fetchPage = useCallback(async (nextCursor: string | null, append: boolean, request: number) => {
    const activeUser = userRef.current;
    if (!activeUser || !ownerId) { setStatus("error"); setLoadingMore(false); return; }
    try {
      const token = await activeUser.getIdToken();
      const query = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : "";
      const response = await fetch(`/api/managed-assets/inventory${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("Inventory request failed.");
      const body: unknown = await response.json();
      if (!isInventoryPage(body, ownerId)) throw new Error("Invalid inventory response.");
      if (requestRef.current !== request) return;
      const nextPaths = new Set(body.items.map((item) => item.pathname));
      if (nextPaths.size !== body.items.length || [...nextPaths].some((path) => pathnamesRef.current.has(path))) throw new Error("Repeated inventory item.");
      if (body.hasMore && body.cursor && cursorSetRef.current.has(body.cursor)) throw new Error("Repeated inventory cursor.");
      body.items.forEach((item) => pathnamesRef.current.add(item.pathname));
      if (body.hasMore && body.cursor) cursorSetRef.current.add(body.cursor);
      setItems((current) => append
        ? [...current, ...body.items.filter((item) => !current.some((existing) => existing.pathname === item.pathname))]
        : body.items);
      setCursor(body.cursor ?? null);
      setHasMore(body.hasMore);
      setStatus("ready");
      setPageError(false);
    } catch {
      if (requestRef.current !== request) return;
      if (append) setPageError(true); else setStatus("error");
    } finally {
      if (requestRef.current === request) setLoadingMore(false);
    }
  }, [ownerId]);

  const loadFirstPage = useCallback(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    pathnamesRef.current.clear();
    cursorSetRef.current.clear();
    setItems([]); setFocusedItem(null); setFocusError(false); setCursor(null); setHasMore(false); selectedPathRef.current = null; setSelectedPath(null); setMetadata(null);
    setStatus("loading");
    void fetchPage(null, false, request);
    void listManagedAssetUploadIntents().then(setIntents, () => setIntents([]));
  }, [fetchPage]);

  useEffect(() => {
    const activeUser = userRef.current;
    if (!focusPathname || !activeUser) return;
    let active = true;
    setFocusAnnotationError(false);
    void (async () => {
      try {
        const token = await activeUser.getIdToken();
        const response = await fetch(`/api/managed-assets/metadata?pathname=${encodeURIComponent(focusPathname)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        });
        if (!response.ok) {
          const errorBody: unknown = await response.json().catch(() => null);
          if (active && typeof errorBody === "object" && errorBody !== null && (errorBody as Record<string, unknown>).error === "annotations_unavailable") {
            setFocusAnnotationError(true);
          }
          throw new Error("Physical object could not be resolved.");
        }
        const value: unknown = await response.json();
        if (typeof value !== "object" || value === null) throw new Error("Invalid physical metadata.");
        const body = value as Record<string, unknown>;
        if (
          body.pathname !== focusPathname || typeof body.url !== "string" ||
          typeof body.size !== "number" || typeof body.uploadedAt !== "string" ||
          typeof body.etag !== "string" || typeof body.contentType !== "string" ||
          (body.displayName !== undefined && (typeof body.displayName !== "string" || body.displayName.trim() !== body.displayName
            || !body.displayName || Array.from(body.displayName).length > 512 || /[\\/\p{Cc}]/u.test(body.displayName)))
        ) throw new Error("Invalid physical metadata.");
        if (!active) return;
        setFocusedItem({
          pathname: body.pathname,
          url: body.url,
          size: body.size,
          uploadedAt: body.uploadedAt,
          etag: body.etag,
          ...(typeof body.displayName === "string" ? { displayName: body.displayName } : {}),
        });
        selectedPathRef.current = focusPathname;
        setSelectedPath(focusPathname);
        setFocusError(false);
      } catch {
        if (active) setFocusError(true);
      } finally {
        if (active) onFocusResolved(focusPathname);
      }
    })();
    return () => { active = false; };
  }, [focusPathname, onFocusResolved, ownerId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) loadFirstPage(); });
    return () => { active = false; requestRef.current += 1; };
  }, [loadFirstPage]);

  const selected = items.find((item) => item.pathname === selectedPath)
    ?? (focusedItem?.pathname === selectedPath ? focusedItem : null);
  const selectedPathname = selected?.pathname;
  const selectedUrl = selected?.url;
  const editingSelected = Boolean(selectedPathname && editingPathname === selectedPathname);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setEditingPathname(null);
      setRenameError(null);
    });
    return () => { active = false; };
  }, [selectedPathname]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const activeUser = userRef.current;
      if (!selectedPathname || !selectedUrl || !activeUser) { setMetadata(null); setPreview(null); return; }
      setMetadata(null); setMetadataError(false); setMetadataAnnotationError(false); setPreview(null); setPreviewError(false);
      void (async () => {
      try {
        const token = await activeUser.getIdToken();
        const response = await fetch(`/api/managed-assets/metadata?pathname=${encodeURIComponent(selectedPathname)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        });
        if (!response.ok) {
          const errorBody: unknown = await response.json().catch(() => null);
          if (active && typeof errorBody === "object" && errorBody !== null && (errorBody as Record<string, unknown>).error === "annotations_unavailable") {
            setMetadataAnnotationError(true);
          }
          throw new Error("Metadata unavailable");
        }
        const body: unknown = await response.json();
        if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).contentType !== "string" || typeof (body as Record<string, unknown>).size !== "number") throw new Error("Invalid metadata");
        const actual = body as SelectedMetadata;
        if (!active) return;
        setMetadata(actual);
        setItems((current) => {
          let changed = false;
          const next = current.map((item) => {
            if (item.pathname !== selectedPathname || item.contentType === actual.contentType) return item;
            changed = true;
            return { ...item, contentType: actual.contentType };
          });
          return changed ? next : current;
        });
        setFocusedItem((current) => current?.pathname === selectedPathname && current.contentType !== actual.contentType
          ? { ...current, contentType: actual.contentType }
          : current);
        const itemCategory = categoryForPath(selectedPathname, actual.contentType);
        const filename = selectedPathname.slice(selectedPathname.lastIndexOf("/") + 1);
        const extensionMatch = /\.[a-z0-9]+$/i.exec(filename);
        const extension = extensionMatch?.[0]?.toLowerCase() ?? null;
        const mime = normalizedContentType(actual.contentType);
        if (itemCategory === "images" && extension !== ".svg" && /^image\/(jpeg|png|webp|gif)$/.test(mime)) return;
        if (["audio/mpeg", "audio/wav", "audio/ogg"].includes(mime)) return;
        if (["text/plain", "text/markdown", "text/csv", "application/json", "application/xml", "text/xml"].includes(mime) && actual.size <= PREVIEW_LIMIT) {
          try {
            const textResponse = await fetch(selectedUrl, { cache: "no-store" });
            if (!textResponse.ok) throw new Error("Preview request failed");
            const text = await readBoundedText(textResponse, PREVIEW_LIMIT);
            if (active) setPreview(text);
          } catch {
            if (active) setPreviewError(true);
          }
        }
      } catch {
        if (active) setMetadataError(true);
      }
      })();
    });
    return () => { active = false; };
  }, [selectedPathname, selectedUrl, ownerId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!selectedPathname || !userRef.current) {
        setProtectionLoading(false); setProtectionState("active"); setIsProtected(false); setProtectionError(false); setDeleteRetryAvailable(false);
        return;
      }
      setProtectionLoading(true); setProtectionError(false);
      void (async () => {
        try {
          const token = await userRef.current!.getIdToken();
          const response = await fetch(`/api/managed-assets/protection?pathname=${encodeURIComponent(selectedPathname)}`, {
            headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
          });
          if (!response.ok) throw new Error("Protection state unavailable");
          const value: unknown = await response.json();
          if (typeof value !== "object" || value === null) throw new Error("Invalid protection state");
          const body = value as Record<string, unknown>;
          if (typeof body.protected !== "boolean" || !["active", "deleting", "delete_failed", "deleted"].includes(String(body.state))) {
            throw new Error("Invalid protection state");
          }
          if (active) {
            setIsProtected(body.protected);
            setProtectionState(body.state as typeof protectionState);
            setDeleteRetryAvailable(body.retryAvailable === true);
          }
        } catch {
          if (active) setProtectionError(true);
        } finally {
          if (active) setProtectionLoading(false);
        }
      })();
    });
    return () => { active = false; };
  }, [selectedPathname, ownerId]);

  const updateProtection = async () => {
    if (!selectedPathname || !user || protectionBusy || protectionLoading || protectionState !== "active") return;
    setProtectionBusy(true); setProtectionError(false);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/managed-assets/protection", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: selectedPathname, protected: !isProtected }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Protection update failed");
      const value: unknown = await response.json();
      if (typeof value !== "object" || value === null || typeof (value as Record<string, unknown>).protected !== "boolean") {
        throw new Error("Invalid protection response");
      }
      setIsProtected((value as { protected: boolean }).protected);
    } catch { setProtectionError(true); }
    finally { setProtectionBusy(false); }
  };

  const beginRename = () => {
    if (!selected || !canRename || renameBusy || protectionLoading || protectionState !== "active") return;
    setRenameDraft(selectedName);
    setRenameError(null);
    setEditingPathname(selected.pathname);
  };

  const cancelRename = () => {
    setEditingPathname(null);
    setRenameDraft(selectedName);
    setRenameError(null);
  };

  const saveRename = async () => {
    if (!selectedPathname || !user || !canRename || !editingSelected || renameBusy) return;
    const displayName = renameDraft.trim();
    if (!displayName) { setRenameError("required"); return; }
    if (Array.from(displayName).length > 512 || /[\\/\p{Cc}]/u.test(displayName)) { setRenameError("invalid"); return; }
    setRenameBusy(true);
    setRenameError(null);
    const pathname = selectedPathname;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/managed-assets/rename", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pathname, displayName }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Rename failed");
      const value: unknown = await response.json();
      if (typeof value !== "object" || value === null || typeof (value as Record<string, unknown>).displayName !== "string") {
        throw new Error("Invalid rename response");
      }
      const savedName = (value as { displayName: string }).displayName;
      if (savedName.trim() !== savedName || !savedName || Array.from(savedName).length > 512 || /[\\/\p{Cc}]/u.test(savedName)) {
        throw new Error("Invalid rename response");
      }
      setItems((current) => current.map((item) => item.pathname === pathname ? { ...item, displayName: savedName } : item));
      setFocusedItem((current) => current?.pathname === pathname ? { ...current, displayName: savedName } : current);
      if (selectedPathRef.current === pathname) {
        setRenameDraft(savedName);
        setEditingPathname(null);
      }
    } catch {
      if (selectedPathRef.current === pathname) setRenameError("failed");
    }
    finally { setRenameBusy(false); }
  };

  const deleteSelected = async () => {
    if (!selectedPathname || !user || deleting || isProtected) return;
    setDeleting(true); setDeleteError(false);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/managed-assets/delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: selectedPathname }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Physical deletion failed");
      setDeleteConfirmOpen(false);
      onPhysicalDelete();
    } catch { setDeleteError(true); }
    finally { setDeleting(false); }
  };

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);
    return items.filter((item) => {
      const name = logicalName(item, intents, files, fonts) ?? shortId(item);
      return (category === "all" || categoryFor(item, knownContentType(item, intents, files, fonts)) === category)
        && (!needle || `${name} ${item.pathname} ${extensionFor(item) ?? ""}`.toLocaleLowerCase(locale).includes(needle));
    }).sort((a, b) => {
      if (sort === "type") return categoryFor(a, knownContentType(a, intents, files, fonts)).localeCompare(categoryFor(b, knownContentType(b, intents, files, fonts))) || (logicalName(a, intents, files, fonts) ?? shortId(a)).localeCompare(logicalName(b, intents, files, fonts) ?? shortId(b), locale);
      const dateOrder = Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt);
      return sort === "date-asc" ? dateOrder : -dateOrder;
    });
  }, [category, files, fonts, intents, items, locale, search, sort]);

  const copy = async (value: string, kind: "id" | "url") => {
    setCopyError(false); setCopied(null);
    try { await navigator.clipboard.writeText(value); setCopied(kind); }
    catch { setCopyError(true); }
  };

  const selectedName = selected ? logicalName(selected, intents, files, fonts) ?? shortId(selected) : "";
  const canRename = Boolean(selected && ownerId && isManagedAssetControlPath(ownerId, selected.pathname));
  const selectedCategory = selected ? categoryFor(selected, metadata?.contentType) : "other";
  const selectedExtension = selected ? extensionFor(selected) : null;
  const canOpen = selected && metadata && (
    (selectedCategory === "images" && selectedExtension !== ".svg" && /^image\/(jpeg|png|webp|gif)$/.test(normalizedContentType(metadata.contentType))) ||
    ["audio/mpeg", "audio/wav", "audio/ogg", "text/plain", "text/markdown", "text/csv", "application/json"].includes(normalizedContentType(metadata.contentType))
  );

  return (
    <div className={styles.storageManager} data-storage-manager>
      <section className={styles.storageListPane} aria-label={t("library.storage.title")}>
        <div className={styles.storageControls}>
          <label className={styles.storageControl}><span>{t("library.storage.search")}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label className={styles.storageControl}><span>{t("library.storage.filter")}</span><select value={category} onChange={(event) => setCategory(event.target.value as Category | "all")}>
            {(["all", "images", "audio", "fonts", "text", "structured-data", "other"] as const).map((value) => <option key={value} value={value}>{value === "all" ? t("library.storage.allCategories") : categoryLabel(value, t)}</option>)}
          </select></label>
          <label className={styles.storageControl}><span>{t("library.storage.sortLoaded")}</span><select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
            <option value="date-desc">{t("library.storage.newest")}</option><option value="date-asc">{t("library.storage.oldest")}</option><option value="type">{t("library.storage.type")}</option>
          </select></label>
          <span className={styles.storageLoadedCount}>{t("library.storage.loadedCount", { count: items.length })}</span>
        </div>
        <div className={styles.storageStatusRow}>
          <StorageUsageIndicator enabled={true} refreshKey={usageRefreshKey} />
          {focusError ? <p className={styles.storagePreviewFallback} role="status">{t(focusAnnotationError ? "library.storage.annotationsUnavailable" : "library.storage.focusUnavailable")}</p> : null}
        </div>
        {uploadError ? <p className={styles.errorText} role="alert">{uploadError}</p> : null}
        {uploading ? <p className={styles.stateBlock} role="status">{t("library.storage.uploading")}</p> : null}
        {status === "loading" ? <p className={styles.stateBlock}>{t("library.storage.loading")}</p> : null}
        {status === "error" ? <div className={styles.stateBlock}><p>{t("library.storage.loadFailed")}</p><Button size="compact" onClick={loadFirstPage}>{t("library.retry")}</Button></div> : null}
        {status === "ready" && items.length === 0 ? <p className={styles.stateBlock}>{t("library.storage.empty")}</p> : null}
        {status === "ready" && items.length > 0 && visibleItems.length === 0 ? <p className={styles.stateBlock}>{t("library.storage.noMatches")}</p> : null}
        <ul className={styles.storageRows}>
          {visibleItems.map((item) => {
            const name = logicalName(item, intents, files, fonts) ?? shortId(item);
            const itemCategory = categoryFor(item, knownContentType(item, intents, files, fonts));
            return <li key={item.pathname}><button type="button" className={styles.storageRow} data-storage-row data-selected={selectedPath === item.pathname} aria-pressed={selectedPath === item.pathname} onClick={() => { selectedPathRef.current = item.pathname; setSelectedPath(item.pathname); }}>
              <span className={styles.storageTypeIcon} aria-hidden="true">{itemCategory === "images" ? "▧" : itemCategory === "audio" ? "♫" : itemCategory === "fonts" ? "Aa" : itemCategory === "text" || itemCategory === "structured-data" ? "≡" : "◇"}</span>
              <span className={styles.storageRowText}><strong>{name}</strong><span>{categoryLabel(itemCategory, t)}{extensionFor(item) ? ` · ${extensionFor(item)}` : ""}</span></span>
              <span className={styles.storageRowMeta}>{formatBytes(item.size, locale)} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.uploadedAt))}</span>
            </button></li>;
          })}
        </ul>
        {libraryAssets.length > 0 ? <section aria-label={t("library.storage.libraryAssets")} data-library-managed-assets>
          <h3 className={styles.detailsHeading}>{t("library.storage.libraryAssets")}</h3>
          <p className={styles.storagePreviewFallback}>{t("library.storage.libraryAssetsHelp")}</p>
          <ul className={styles.storageRows}>
            {libraryAssets.map((asset) => <li key={asset.pathname} className={styles.storageRow} data-library-managed-asset={asset.pathname}>
              <span className={styles.storageTypeIcon} aria-hidden="true">◇</span>
              <span className={styles.storageRowText}>
                <strong>{asset.label}</strong>
                <span>{t("library.storage.libraryAssetAssociation")}</span>
              </span>
              <ManagedAssetAvailabilityControl
                pathname={asset.pathname}
                compact
                reconciliation={{ assetName: asset.label, associations: asset.associations, onComplete: onPhysicalDelete }}
              />
            </li>)}
          </ul>
        </section> : null}
        {pageError ? <p className={styles.errorText} role="alert">{t("library.storage.loadMoreFailed")}</p> : null}
        {hasMore ? <Button size="compact" disabled={loadingMore} onClick={() => { if (cursor && !loadingMore) { setLoadingMore(true); void fetchPage(cursor, true, requestRef.current); } }}>{loadingMore ? t("library.storage.loadingMore") : t("library.storage.loadMore")}</Button> : null}
      </section>
      <aside className={styles.storageDetailsPane} aria-label={t("library.details")} data-storage-details>
        {!selected ? <p className={styles.detailsEmpty}>{t("library.storage.selectFile")}</p> : <>
          <h2 className={styles.detailsHeading}>
            {editingSelected ? <input
              className={styles.storageRenameInput}
              type="text"
              autoFocus
              value={renameDraft}
              maxLength={1024}
              aria-label={t("library.storage.rename")}
              disabled={renameBusy}
              onChange={(event) => { setRenameDraft(event.target.value); setRenameError(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); void saveRename(); }
                else if (event.key === "Escape") { event.preventDefault(); cancelRename(); }
              }}
            /> : selectedName}
          </h2>
          {editingSelected && renameError ? <p className={styles.errorText} role="alert">{t(renameError === "required" ? "library.storage.renameNameRequired" : renameError === "invalid" ? "library.storage.renameNameInvalid" : "library.storage.renameFailed")}</p> : null}
          <dl className={styles.detailsList}>
            <div className={styles.detailsRow}><dt>{t("library.storage.categoryLabel")}</dt><dd>{categoryLabel(selectedCategory, t)}{selectedExtension ? ` · ${selectedExtension}` : ""}</dd></div>
            <div className={styles.detailsRow}><dt>{t("library.storage.mime")}</dt><dd>{metadata?.contentType ?? (metadataError ? t("library.storage.unknown") : t("library.storage.loading") )}</dd></div>
            <div className={styles.detailsRow}><dt>{t("library.storage.sizeLabel")}</dt><dd>{formatBytes(metadata?.size ?? selected.size, locale)}</dd></div>
            <div className={styles.detailsRow}><dt>{t("library.storage.uploaded")}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.uploadedAt))}</dd></div>
          </dl>
          {metadataError ? <p className={styles.storagePreviewFallback}>{t(metadataAnnotationError ? "library.storage.annotationsUnavailable" : "library.storage.metadataUnavailable")}</p> : null}
          {metadata && selectedCategory === "images" && selectedExtension !== ".svg" && /^image\/(jpeg|png|webp|gif)$/.test(normalizedContentType(metadata.contentType)) ? <div className={styles.storagePreview}><img src={selected.url} alt={selectedName} loading="lazy" /></div> : null}
          {metadata && selectedCategory === "audio" && ["audio/mpeg", "audio/wav", "audio/ogg"].includes(normalizedContentType(metadata.contentType)) ? <audio className={styles.storageAudio} controls preload="none" src={selected.url}>{t("library.storage.audioUnsupported")}</audio> : null}
          {preview !== null ? <pre className={styles.storageTextPreview} data-storage-preview>{preview}</pre> : null}
          {previewError ? <p className={styles.storagePreviewFallback}>{t("library.storage.previewFailed")}</p> : null}
          {metadata && metadata.size > PREVIEW_LIMIT && (selectedCategory === "text" || selectedCategory === "structured-data") ? <p className={styles.storagePreviewFallback}>{t("library.storage.previewTooLarge")}</p> : null}
          {metadata && !canOpen ? <p className={styles.storagePreviewFallback}>{t("library.storage.previewUnsupported")}</p> : null}
          <div className={styles.storageActionRow} data-storage-action-row="files">
            {canOpen ? <a className={`${styles.storageActionLink} ps-ui-button ps-ui-button--ghost ps-ui-button--compact`} href={selected.url} target="_blank" rel="noopener noreferrer">{t("library.storage.openFile")}</a> : null}
            <Button size="compact" disabled={renameBusy} onClick={() => void copy(selected.url, "url")}>{copied === "url" ? t("library.storage.copied") : t("library.storage.copyUrl")}</Button>
          </div>
          <div className={styles.storageActionRow} data-storage-action-row="controls">
            {editingSelected ? <>
              <Button size="compact" variant="primary" disabled={renameBusy} onClick={() => void saveRename()}>{renameBusy ? t("customLibrary.fileDetails.saving" as StudioMessageKey) : t("library.storage.save")}</Button>
              <Button size="compact" disabled={renameBusy} onClick={cancelRename}>{t("library.storage.cancel")}</Button>
            </> : <>
              <Button size="compact" disabled={!canRename || renameBusy || protectionLoading || protectionState !== "active"} onClick={beginRename}>{t("library.storage.rename")}</Button>
              <Button size="compact" disabled={protectionLoading || protectionBusy || protectionState !== "active"} onClick={() => void updateProtection()}>
                {protectionBusy ? t("library.storage.protectionSaving") : isProtected ? t("library.storage.unprotect") : t("library.storage.protect")}
              </Button>
              <Button size="compact" variant="danger" disabled={protectionLoading || protectionError || protectionBusy || deleting || isProtected || protectionState === "deleted" || (protectionState === "deleting" && !deleteRetryAvailable)} onClick={() => { setDeleteError(false); setDeleteConfirmOpen(true); }}>
                {protectionState === "delete_failed" || (protectionState === "deleting" && deleteRetryAvailable) ? t("library.storage.retryDelete") : t("library.storage.deleteFile")}
              </Button>
            </>}
          </div>
        {isProtected ? <p className={styles.storagePreviewFallback} role="status">{t("library.storage.protectedStatus")}</p> : null}
        {protectionError ? <p className={styles.errorText} role="alert">{t("library.storage.protectionFailed")}</p> : null}
        {deleteError ? <p className={styles.errorText} role="alert">{t("library.storage.deleteFailed")}</p> : null}
          {copyError ? <p className={styles.errorText} role="alert">{t("library.storage.copyFailed")}</p> : null}
          <details className={styles.storageTechnical}><summary>{t("library.storage.technicalDetails")}</summary>
            <dl className={styles.detailsList}>
              <div className={styles.detailsRow}><dt>{t("library.storage.physicalPath")}</dt><dd>{selected.pathname}</dd></div>
              <div className={styles.detailsRow}><dt>{t("library.storage.etag")}</dt><dd>{selected.etag}</dd></div>
              <div className={styles.detailsRow}><dt>{t("library.storage.url")}</dt><dd>{selected.url}</dd></div>
            </dl>
            <Button size="compact" onClick={() => void copy(physicalIdentifier(selected), "id")}>{copied === "id" ? t("library.storage.copied") : t("library.storage.copyId")}</Button>
          </details>
        </>}
      </aside>
      {deleteConfirmOpen && selected ? (
        <DangerConfirmDialog
          title={t("library.storage.deleteConfirmTitle")}
          message={t("library.storage.deleteConfirmMessage", { name: selectedName, identifier: physicalIdentifier(selected) })}
          confirmLabel={t("library.storage.deleteFile")}
          busyConfirmLabel={t("library.storage.deleting")}
          cancelLabel={t("customLibrary.cancel")}
          busy={deleting}
          error={deleteError ? t("library.storage.deleteFailed") : undefined}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={() => void deleteSelected()}
        />
      ) : null}
    </div>
  );
}
