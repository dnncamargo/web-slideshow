// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedAssetUploadIntent } from "../src/features/persistence/managed-asset-storage";

const mocks = vi.hoisted(() => ({
  user: { uid: "owner-1", getIdToken: vi.fn(async () => "owner-token") },
  listIntents: vi.fn(async (): Promise<ManagedAssetUploadIntent[]> => []),
}));
vi.mock("../src/features/auth/studio-auth-provider", () => ({ useStudioAuth: () => ({ user: mocks.user }) }));
vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: () => ({ uid: "owner-1", isAnonymous: false, getIdToken: async () => "owner-token" }),
}));
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
  const onPhysicalDelete = vi.fn();
  act(() => root.render(<StudioI18nProvider><LocaleSetter locale={locale} /><StorageManager files={files} fonts={fonts} uploading={false} uploadError={null} usageRefreshKey={0} focusPathname={focusPathname} onFocusResolved={onFocusResolved} onPhysicalDelete={onPhysicalDelete} /></StudioI18nProvider>));
  return { host, root, onFocusResolved, onPhysicalDelete };
}

const blob = (pathname: string, uploadedAt = "2026-01-02T03:04:05.000Z") => ({ pathname, url: `https://blob.example/${pathname.split("/").at(-1)}`, size: 8, uploadedAt, etag: "provider-etag" });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listIntents.mockResolvedValue([]);
});
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("Storage manager", () => {
  it("keeps two independent compact action rows and an aligned accessible Open file anchor", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [blob("users/owner-1/assets/readme.txt")], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "text/plain", size: 8 });
      return response({ protected: false, state: "active", retryAvailable: false });
    }));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await Promise.resolve(); await Promise.resolve(); });
    const first = host.querySelector('[data-storage-action-row="files"]');
    const second = host.querySelector('[data-storage-action-row="controls"]');
    expect(first?.textContent).toContain("Open file");
    expect(first?.textContent).toContain("Copy URL");
    expect(second?.textContent).toContain("Rename");
    expect(second?.textContent).toContain("Protect file");
    expect(second?.textContent).toContain("Delete file");
    expect(Array.from(second?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Rename")?.disabled).toBe(true);
    const open = first?.querySelector("a");
    expect(open?.getAttribute("href")).toBe("https://blob.example/readme.txt");
    expect(open?.getAttribute("target")).toBe("_blank");
    expect(open?.className).toContain("ps-ui-button--compact");
    expect(host.querySelectorAll("[data-storage-action-row]")).toHaveLength(2);
    expect(host.querySelectorAll("[data-storage-action-row] h1, [data-storage-action-row] h2, [data-storage-action-row] hr")).toHaveLength(0);
    await act(async () => { Array.from(host.querySelectorAll<HTMLButtonElement>("[data-storage-action-row='controls'] button")).find((button) => button.textContent === "Rename")?.click(); await Promise.resolve(); });
    await act(async () => { Array.from(host.querySelectorAll<HTMLButtonElement>("[data-storage-action-row='controls'] button")).find((button) => button.textContent === "Cancel")?.click(); await Promise.resolve(); });
    expect(host.querySelector("[data-storage-details] h2 input")).toBeNull();
    act(() => root.unmount());
  });

  it("resolves Storage names by override, upload intent, File, Font, then physical identifier", async () => {
    const paths = ["override", "intent", "file", "font", "fallback"].map((name) => `users/owner-1/assets/${name}`);
    mocks.listIntents.mockResolvedValueOnce([{
      assetId: "asset-intent", storagePath: paths[1]!, originalFilename: "Intent original.txt", extension: ".txt",
      contentType: "text/plain", expectedSizeBytes: 8, sourceLastModified: 0, state: "complete" as const,
    }] as ManagedAssetUploadIntent[]);
    const file = (storagePath: string, name: string) => ({
      id: `file-${name}`,
      file: { name, kind: "text" as const, representation: "text" as const,
        source: { assetId: `asset-${name}`, storagePath, downloadUrl: "https://blob.example/file", contentType: "text/plain" as const, sizeBytes: 8 } },
    });
    const font = (storagePath: string, family: string) => ({
      id: `font-${family}`,
      font: { family, faces: [{ source: { type: "url" as const, url: `https://blob.example/${storagePath}`, format: "woff2" as const } }] },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({
      scope: "owner", items: paths.map((pathname) => ({ ...blob(pathname), ...(pathname === paths[0] ? { displayName: "Persisted override" } : {}) })), hasMore: false,
    })));
    const { host, root } = renderManager("en", null, [file(paths[1]!, "Library file"), file(paths[2]!, "File name")], [font(paths[2]!, "Font behind File"), font(paths[3]!, "Font family")]);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const rows = Array.from(host.querySelectorAll<HTMLElement>("[data-storage-row]")).map((row) => row.textContent ?? "");
    expect(rows[0]).toContain("Persisted override");
    expect(rows[1]).toContain("Intent original.txt");
    expect(rows[2]).toContain("File name");
    expect(rows[3]).toContain("Font family");
    expect(rows[4]).toContain("fallback");
    act(() => root.unmount());
  });

  it("renames in place, updates search and type-name sorting, and preserves the selected pathname", async () => {
    const left = "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png";
    const right = "users/owner-1/assets/223e4567-e89b-42d3-a456-426614174000.png";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [{ ...blob(left), displayName: "zebra" }, { ...blob(right), displayName: "alpha" }], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "image/png", size: 8 });
      if (url === "/api/managed-assets/rename" && init?.method === "PATCH") return response({ displayName: "Aardvark image", protected: false, state: "active" });
      if (url.startsWith("/api/managed-assets/protection?")) return response({ protected: false, state: "active", retryAvailable: false });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { host.querySelectorAll<HTMLButtonElement>("[data-storage-row]")[0]?.click(); await Promise.resolve(); await Promise.resolve(); });
    const rename = Array.from(host.querySelectorAll<HTMLButtonElement>("[data-storage-action-row='controls'] button")).find((button) => button.textContent === "Rename");
    await act(async () => { rename?.click(); await Promise.resolve(); });
    const input = host.querySelector<HTMLInputElement>("[data-storage-details] h2 input");
    expect(input?.value).toBe("zebra");
    expect(document.activeElement).toBe(input);
    expect(host.querySelector("[data-storage-action-row='controls']")?.textContent).toContain("Save");
    expect(host.querySelector("[data-storage-action-row='controls']")?.textContent).toContain("Cancel");
    expect(host.querySelector("[data-storage-action-row='controls']")?.textContent).not.toContain("Protect file");
    await act(async () => { if (input) changeInput(input, "Aardvark image"); await Promise.resolve(); });
    await act(async () => { Array.from(host.querySelectorAll<HTMLButtonElement>("[data-storage-action-row='controls'] button")).find((button) => button.textContent === "Save")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(fetchMock).toHaveBeenCalledWith("/api/managed-assets/rename", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ pathname: left, displayName: "Aardvark image" }) }));
    expect(host.querySelector("[data-storage-details]")?.textContent).toContain("Aardvark image");
    expect(host.querySelectorAll("[data-storage-row]")[0]?.textContent).toContain("Aardvark image");
    expect(host.querySelector("[data-storage-row][aria-pressed='true']")?.getAttribute("data-selected")).toBe("true");
    const search = host.querySelector<HTMLInputElement>("input[type='search']");
    await act(async () => { if (search) changeInput(search, "Aardvark"); await Promise.resolve(); });
    expect(host.querySelectorAll("[data-storage-row]")).toHaveLength(1);
    const sortSelect = host.querySelectorAll<HTMLSelectElement>("select")[1];
    await act(async () => { if (sortSelect) { sortSelect.value = "type"; sortSelect.dispatchEvent(new Event("change", { bubbles: true })); } await Promise.resolve(); });
    expect(host.querySelector("[data-storage-row]")?.textContent).toContain("Aardvark image");
    act(() => root.unmount());
  });

  it("keeps an invalid or failed rename draft and supports Enter and Escape", async () => {
    const pathname = "users/owner-1/assets/323e4567-e89b-42d3-a456-426614174000.txt";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [{ ...blob(pathname), displayName: "notes.txt" }], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "text/plain", size: 8 });
      if (url === "/api/managed-assets/rename" && init?.method === "PATCH") return response({ error: "unavailable" }, 503);
      if (url.startsWith("/api/managed-assets/protection?")) return response({ protected: false, state: "active", retryAvailable: false });
      return response({});
    }));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { Array.from(host.querySelectorAll<HTMLButtonElement>("[data-storage-action-row='controls'] button")).find((button) => button.textContent === "Rename")?.click(); await Promise.resolve(); });
    let input = host.querySelector<HTMLInputElement>("[data-storage-details] h2 input");
    await act(async () => { if (input) changeInput(input, "bad/name"); Array.from(host.querySelectorAll<HTMLButtonElement>("[data-storage-action-row='controls'] button")).find((button) => button.textContent === "Save")?.click(); await Promise.resolve(); });
    expect(host.textContent).toContain("Use up to 512 characters without slashes");
    expect(host.querySelector<HTMLInputElement>("[data-storage-details] h2 input")?.value).toBe("bad/name");
    await act(async () => { input = host.querySelector<HTMLInputElement>("[data-storage-details] h2 input"); if (input) { changeInput(input, "kept draft"); input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); } await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(host.textContent).toContain("Could not rename this file.");
    expect(host.querySelector<HTMLInputElement>("[data-storage-details] h2 input")?.value).toBe("kept draft");
    await act(async () => { input = host.querySelector<HTMLInputElement>("[data-storage-details] h2 input"); input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await Promise.resolve(); });
    expect(host.querySelector("[data-storage-details] h2 input")).toBeNull();
    expect(host.querySelector("[data-storage-action-row='controls']")?.textContent).toContain("Delete file");
    act(() => root.unmount());
  });

  it("keeps non-eligible legacy files visible with their fallback name and disables Rename", async () => {
    const pathname = "users/owner-1/assets/arquivo-antigo.png";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [blob(pathname)], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "image/png", size: 8 });
      if (url.startsWith("/api/managed-assets/protection?")) return response({ protected: false, state: "active", retryAvailable: false });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const { host, root } = renderManager();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    const rename = Array.from(host.querySelectorAll<HTMLButtonElement>("[data-storage-action-row='controls'] button"))
      .find((button) => button.textContent === "Rename");
    expect(host.querySelector("[data-storage-details]")?.textContent).toContain("arquivo-antigo");
    expect(rename?.disabled).toBe(true);
    await act(async () => { rename?.click(); await Promise.resolve(); });
    expect(host.querySelector("[data-storage-details] h2 input")).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/managed-assets/rename")).toBe(false);
    act(() => root.unmount());
  });

  it("lists owner-scoped physical objects, selects details, and safely previews text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [blob("users/owner-1/assets/readme.txt")], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "text/plain", size: 8 });
      if (url.startsWith("/api/managed-assets/protection?")) return response({ protected: false, state: "active", retryAvailable: false });
      return new Response("<script>unsafe()</script>", { status: 200 });
    });
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
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [blob("users/owner-1/assets/unsafe.svg")], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "image/svg+xml", size: 8 });
      return response({ protected: false, state: "active", retryAvailable: false });
    }));
    const { host, root } = renderManager();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(host.querySelector("[data-storage-details] img")).toBeNull();
    expect(host.querySelector("[data-storage-details] a")).toBeNull();
    expect(host.textContent).toContain("Preview is not available");
    act(() => root.unmount());
  });

  it("shows a preview failure without losing verified physical details", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [blob("users/owner-1/assets/readme.txt")], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "text/plain", size: 8 });
      if (url.startsWith("/api/managed-assets/protection?")) return response({ protected: false, state: "active", retryAvailable: false });
      return new Response("", { status: 503 });
    }));
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

  it("updates a legacy item's classification after authenticated physical metadata resolves", async () => {
    const pathname = "users/owner-1/assets/legacy-photo";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [blob(pathname)], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "image/png", size: 8 });
      if (url.startsWith("/api/managed-assets/protection?")) return response({ protected: false, state: "active", retryAvailable: false });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const { host, root } = renderManager();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(host.textContent).toContain("Other / Unknown");
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(host.textContent).toContain("image/png");
    const categoryFilter = host.querySelectorAll<HTMLSelectElement>("select")[0];
    await act(async () => {
      if (!categoryFilter) return;
      categoryFilter.value = "images";
      categoryFilter.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(host.querySelectorAll("[data-storage-row]")).toHaveLength(1);
    expect(host.textContent).toContain("legacy-photo");
    act(() => root.unmount());
  });

  it("persists protection and requires confirmation before deleting only the selected path", async () => {
    const pathname = "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png";
    let protectedValue = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [blob(pathname)], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "image/png", size: 8 });
      if (url.startsWith("/api/managed-assets/protection?") && !init?.method) return response({ protected: protectedValue, state: "active", retryAvailable: false });
      if (url === "/api/managed-assets/protection" && init?.method === "PUT") {
        protectedValue = Boolean(JSON.parse(String(init.body)).protected);
        return response({ protected: protectedValue, state: "active" });
      }
      if (url === "/api/managed-assets/delete" && init?.method === "DELETE") return response({ alreadyMissing: false });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const { host, root, onPhysicalDelete } = renderManager();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    const button = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((entry) => entry.textContent === label);
    await act(async () => { button("Protect file")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(protectedValue).toBe(true);
    expect(host.textContent).toContain("This file is protected from deletion.");
    expect(button("Delete file")?.disabled).toBe(true);
    await act(async () => { button("Unprotect file")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(protectedValue).toBe(false);
    await act(async () => { button("Delete file")?.click(); await Promise.resolve(); });
    expect(host.textContent).toContain("Delete this file?");
    expect(host.textContent).toContain(pathname);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === "/api/managed-assets/delete" && init?.method === "DELETE")).toBe(false);
    const confirm = host.querySelector<HTMLDivElement>("[data-studio-danger-confirm-dialog]")
      ? Array.from(host.querySelectorAll<HTMLButtonElement>("[data-studio-danger-confirm-dialog] button")).find((entry) => entry.textContent === "Delete file")
      : undefined;
    await act(async () => { confirm?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(fetchMock).toHaveBeenCalledWith("/api/managed-assets/delete", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ pathname }) }));
    expect(onPhysicalDelete).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("localizes protection and explicit deletion confirmation in Portuguese", async () => {
    const pathname = "users/owner-1/assets/legacy-image";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [blob(pathname)], hasMore: false });
      if (url.startsWith("/api/managed-assets/metadata?")) return response({ contentType: "image/png", size: 8 });
      return response({ protected: false, state: "active", retryAvailable: false });
    }));
    const { host, root } = renderManager("pt-BR");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => { host.querySelector<HTMLButtonElement>("[data-storage-row]")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(host.textContent).toContain("Proteger arquivo");
    expect(host.textContent).toContain("Excluir arquivo");
    const deleteButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Excluir arquivo");
    await act(async () => { deleteButton?.click(); await Promise.resolve(); });
    expect(host.textContent).toContain("Excluir este arquivo?");
    expect(host.textContent).toContain("identificador físico legacy-image");
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
    const physical = { ...blob(pathname), url: "https://blob.example/exact.woff2", etag: "exact-etag", contentType: "font/woff2", displayName: "Focused font" };
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
    expect(host.querySelector("[data-storage-details]")?.textContent).toContain("Focused font");
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

  it("exposes explicit availability and reconciliation only for library references in Storage Manager", async () => {
    const pathname = "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.woff2";
    const downloadUrl = "https://fixture.public.blob.vercel-storage.com/" + pathname;
    const file = {
      id: "file-font-1",
      file: {
        name: "Fixture font file", kind: "font" as const, representation: "binary" as const,
        source: {
          assetId: "123e4567-e89b-42d3-a456-426614174000", storagePath: pathname,
          downloadUrl, contentType: "font/woff2" as const, sizeBytes: 8,
        },
      },
    };
    const font = {
      id: "font-1",
      font: {
        family: "Fixture Sans",
        faces: [{
          source: { type: "url" as const, url: downloadUrl, format: "woff2" as const },
          provenance: { kind: "managed-upload" as const, assetId: "123e4567-e89b-42d3-a456-426614174000" },
        }],
      },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/managed-assets/inventory") return response({ scope: "owner", items: [], hasMore: false });
      if (url === "/api/managed-assets/availability") return response({ state: "missing", storeId: "test-store" });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const { host, root } = renderManager("en", null, [file], [font]);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const candidate = host.querySelector<HTMLElement>('[data-library-managed-asset="' + pathname + '"]');
    expect(candidate?.textContent).toContain("Fixture font file");
    expect(host.querySelector("[data-library-managed-assets]")?.textContent).toContain("Custom Library asset references");
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/managed-assets/availability")).toBe(false);
    await act(async () => {
      Array.from(candidate?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find((button) => button.textContent === "Check availability")?.click();
    });
    expect(candidate?.textContent).toContain("Source missing");
    expect(candidate?.textContent).toContain("Reconcile missing asset");
    await act(async () => {
      Array.from(candidate?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find((button) => button.textContent === "Reconcile missing asset")?.click();
    });
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Fixture font file (File), Fixture Sans · WOFF2 (Font face)");
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/managed-assets/reconcile")).toBe(false);
    act(() => root.unmount());
  });
});
