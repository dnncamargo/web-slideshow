// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { uid: "owner-1", getIdToken: vi.fn(async () => "owner-token") },
  listIntents: vi.fn(async () => []),
}));
vi.mock("../src/features/auth/studio-auth-provider", () => ({ useStudioAuth: () => ({ user: mocks.user }) }));
vi.mock("../src/features/persistence/managed-asset-storage", () => ({ listManagedAssetUploadIntents: mocks.listIntents }));
vi.mock("../src/features/library/storage-usage-indicator", () => ({ StorageUsageIndicator: () => <div data-storage-usage-indicator /> }));

import { StudioI18nProvider, useStudioI18n } from "../src/features/i18n/studio-i18n-context";
import { StorageManager } from "../src/features/library/storage-manager";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function LocaleSetter({ locale }: { locale: "en" | "pt-BR" }) {
  const { setLocale } = useStudioI18n();
  useEffect(() => setLocale(locale), [locale, setLocale]);
  return null;
}

function renderManager(
  locale: "en" | "pt-BR" = "en",
  focusPathname: string | null = null,
  files: React.ComponentProps<typeof StorageManager>["files"] = [],
  fonts: React.ComponentProps<typeof StorageManager>["fonts"] = [],
) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onFocusResolved = vi.fn();
  act(() => root.render(<StudioI18nProvider><LocaleSetter locale={locale} /><StorageManager files={files} fonts={fonts} uploading={false} uploadError={null} usageRefreshKey={0} focusPathname={focusPathname} onFocusResolved={onFocusResolved} /></StudioI18nProvider>));
  return { host, root, onFocusResolved };
}

const blob = (pathname: string, uploadedAt = "2026-01-02T03:04:05.000Z") => ({ pathname, url: `https://blob.example/${pathname.split("/").at(-1)}`, size: 8, uploadedAt, etag: "provider-etag" });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listIntents.mockResolvedValue([]);
});
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("Storage manager", () => {
  it("lists owner-scoped physical objects, selects details, and safely previews text", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ scope: "owner", items: [blob("users/owner-1/assets/readme.txt")], hasMore: false }))
      .mockResolvedValueOnce(response({ contentType: "text/plain", size: 8 }))
      .mockResolvedValueOnce(new Response("<script>unsafe()</script>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(host.textContent).toContain("readme");
    const row = host.querySelector<HTMLButtonElement>("[data-storage-row]");
    await act(async () => { row?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(row?.getAttribute("aria-pressed")).toBe("true");
    expect(host.textContent).toContain("text/plain");
    expect(host.querySelector("[data-storage-preview]")?.textContent).toBe("<script>unsafe()</script>");
    expect(host.querySelector("[data-storage-preview] script")).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/managed-assets/metadata?pathname="), expect.objectContaining({ headers: { Authorization: "Bearer owner-token" }, cache: "no-store" }));
    act(() => root.unmount());
  });

  it("does not render SVG as an executable preview or open it directly", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ scope: "owner", items: [blob("users/owner-1/assets/unsafe.svg")], hasMore: false }))
      .mockResolvedValueOnce(response({ contentType: "image/svg+xml", size: 8 })));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(host.querySelector("[data-storage-details] img")).toBeNull();
    expect(host.querySelector("[data-storage-details] a")).toBeNull();
    expect(host.textContent).toContain("Preview is not available");
    act(() => root.unmount());
  });

  it("shows a preview failure without losing verified physical details", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ scope: "owner", items: [blob("users/owner-1/assets/readme.txt")], hasMore: false }))
      .mockResolvedValueOnce(response({ contentType: "text/plain", size: 8 }))
      .mockResolvedValueOnce(new Response("", { status: 503 })));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(host.textContent).toContain("text/plain");
    expect(host.textContent).toContain("Could not load the preview.");
    act(() => root.unmount());
  });

  it("offers category filtering and labels sorting as applying to loaded items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ scope: "owner", items: [blob("users/owner-1/assets/photo.png"), blob("users/owner-1/assets/song.mp3")], hasMore: true, cursor: "next" })));
    const { host, root } = renderManager("pt-BR");
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(host.textContent).toContain("2 carregados");
    expect(host.textContent).toContain("Ordenar arquivos carregados");
    expect(host.querySelector("select option[value='images']")?.textContent).toBe("Imagens");
    const categoryFilter = host.querySelectorAll("select")[0];
    await act(async () => {
      if (!categoryFilter) return;
      categoryFilter.value = "images";
      categoryFilter.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(host.querySelectorAll("[data-storage-row]")).toHaveLength(1);
    expect(host.textContent).toContain("photo");
    expect(host.textContent).not.toContain("song");
    act(() => root.unmount());
  });

  it("paginates on demand without implying that sorting covers unloaded objects", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ scope: "owner", items: [blob("users/owner-1/assets/first.png")], hasMore: true, cursor: "opaque-next" }))
      .mockResolvedValueOnce(response({ scope: "owner", items: [blob("users/owner-1/assets/second.json")], hasMore: false }));
    vi.stubGlobal("fetch", fetchMock);
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const loadMore = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Load more");
    await act(async () => { loadMore?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/managed-assets/inventory?cursor=opaque-next", expect.any(Object));
    expect(host.querySelectorAll("[data-storage-row]")).toHaveLength(2);
    expect(host.textContent).toContain("2 loaded");
    act(() => root.unmount());
  });

  it("sorts the currently loaded rows by date and type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ scope: "owner", items: [
      blob("users/owner-1/assets/later.png", "2026-02-01T00:00:00.000Z"),
      blob("users/owner-1/assets/earlier.mp3", "2026-01-01T00:00:00.000Z"),
    ], hasMore: true, cursor: "not-loaded-yet" })));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const rows = () => Array.from(host.querySelectorAll<HTMLElement>("[data-storage-row]")).map((row) => row.textContent ?? "");
    const sortSelect = host.querySelectorAll<HTMLSelectElement>("select")[1];
    await act(async () => {
      if (!sortSelect) return;
      sortSelect.value = "date-asc";
      sortSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(rows()[0]).toContain("earlier");
    await act(async () => {
      if (!sortSelect) return;
      sortSelect.value = "type";
      sortSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(rows()[0]).toContain("earlier");
    expect(host.textContent).toContain("2 loaded");
    act(() => root.unmount());
  });

  it("classifies supported extensions and keeps unknown extensions in Other / Unknown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ scope: "owner", items: [
      blob("users/owner-1/assets/photo.png"), blob("users/owner-1/assets/song.mp3"),
      blob("users/owner-1/assets/typeface.woff2"), blob("users/owner-1/assets/readme.txt"),
      blob("users/owner-1/assets/data.json"), blob("users/owner-1/assets/archive.exe"),
    ], hasMore: false })));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    for (const label of ["Images", "Audio", "Fonts", "Text", "Structured data", "Other / Unknown"]) {
      expect(host.textContent).toContain(label);
    }
    act(() => root.unmount());
  });

  it("uses exact matching File and Font metadata for names and legacy types", async () => {
    const legacyFile = {
      id: "library-file-1",
      file: {
        name: "legacy-notes.txt", kind: "text" as const, representation: "text" as const,
        source: { assetId: "legacy", storagePath: "users/owner-1/assets/extensionless-file", downloadUrl: "https://blob.example/extensionless-file", contentType: "text/plain" as const, sizeBytes: 8 },
      },
    };
    const libraryFont = {
      id: "font-record-1",
      font: { family: "Fixture Sans", faces: [{ source: { type: "url" as const, url: "https://blob.example/users/owner-1/assets/extensionless-font", format: "woff2" as const } }] },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({
      scope: "owner",
      items: [blob("users/owner-1/assets/extensionless-file"), blob("users/owner-1/assets/extensionless-font")],
      hasMore: false,
    })));
    const { host, root } = renderManager("en", null, [legacyFile], [libraryFont]);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(host.textContent).toContain("legacy-notes.txt");
    expect(host.textContent).toContain("Fixture Sans");
    expect(host.textContent).toContain("legacy-notes.txtText");
    expect(host.textContent).toContain("Fixture SansFonts");
    act(() => root.unmount());
  });

  it("copies the URL and physical identifier from selected-file actions", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ scope: "owner", items: [blob("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png")], hasMore: false }))
      .mockResolvedValueOnce(response({ contentType: "image/png", size: 8 })));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await Promise.resolve(); await Promise.resolve(); });
    const copyUrl = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Copy URL");
    await act(async () => { copyUrl?.click(); await Promise.resolve(); });
    expect(writeText).toHaveBeenCalledWith("https://blob.example/123e4567-e89b-42d3-a456-426614174000.png");
    const copyId = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Copy physical identifier");
    await act(async () => { copyId?.click(); await Promise.resolve(); });
    expect(writeText).toHaveBeenLastCalledWith("123e4567-e89b-42d3-a456-426614174000");
    act(() => root.unmount());
  });

  it("locates and selects an exact physical object outside the loaded inventory page", async () => {
    const pathname = "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.woff2";
    const physical = { ...blob(pathname), url: "https://blob.example/exact.woff2", etag: "exact-etag", contentType: "font/woff2" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") {
        return response({ scope: "owner", items: [blob("users/owner-1/assets/other.png")], hasMore: false });
      }
      if (url === `/api/managed-assets/metadata?pathname=${encodeURIComponent(pathname)}`) {
        return response(physical);
      }
      return response({ contentType: "font/woff2", size: 8 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { host, root, onFocusResolved } = renderManager("en", pathname);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      "/api/managed-assets/inventory",
      `/api/managed-assets/metadata?pathname=${encodeURIComponent(pathname)}`,
    ]));
    expect(onFocusResolved).toHaveBeenCalledWith(pathname);
    expect(host.querySelector("[data-storage-details]")?.textContent).toContain(pathname);
    expect(host.querySelector("[data-storage-details]")?.textContent).toContain("exact-etag");
    expect(host.textContent).toContain("Fonts");
    expect(fetchMock).toHaveBeenCalledWith(`/api/managed-assets/metadata?pathname=${encodeURIComponent(pathname)}`, expect.objectContaining({ cache: "no-store" }));
    expect(onFocusResolved).toHaveBeenCalledWith(pathname);
    act(() => root.unmount());
  });

  it("keeps inventory failure distinct from an empty inventory", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ error: "unavailable" }, 503)));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(host.textContent).toContain("Could not load files.");
    expect(host.textContent).not.toContain("No files uploaded yet.");
    expect(host.querySelector("[data-storage-usage-indicator]")).toBeTruthy();
    act(() => root.unmount());
  });
});
