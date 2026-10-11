// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  user: { uid: "owner-1", getIdToken: vi.fn(async () => "firebase-token") },
}));

vi.mock("../src/features/auth/studio-auth-provider", () => ({
  useStudioAuth: () => ({ user: authMocks.user }),
}));

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { ManagedAssetInventory } from "../src/features/library/managed-asset-inventory";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderInventory() {
  return (
    <StudioI18nProvider>
      <ManagedAssetInventory />
    </StudioI18nProvider>
  );
}

function item(pathname = "users/owner-1/assets/object-1") {
  return {
    pathname,
    url: "https://blob.example/object-1",
    size: 42,
    uploadedAt: "2026-02-03T04:05:06.000Z",
    etag: "etag-1",
  };
}

describe("Managed Asset Storage inventory UI", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let clipboardDescriptor: PropertyDescriptor | undefined;
  let clipboardWrite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    authMocks.user.getIdToken.mockClear();
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    clipboardWrite = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads physical metadata, selects details, and exposes complete identifier copy controls", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scope: "owner", items: [item()], hasMore: false }),
    });

    await act(async () => {
      root.render(renderInventory());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/managed-assets/inventory", expect.objectContaining({
      headers: { Authorization: "Bearer firebase-token" },
      cache: "no-store",
    }));
    expect(container.textContent).toContain("users/owner-1/assets/object-1");
    expect(container.textContent).toContain("42 B");
    expect(container.textContent).toContain("Feb 3, 2026");
    const selectButton = container.querySelector<HTMLButtonElement>("[data-storage-select]");
    expect(selectButton).toBeTruthy();
    await act(async () => {
      selectButton?.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("etag-1");
    const copyButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Copy physical identifier");
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton?.click();
      await Promise.resolve();
    });
    expect(clipboardWrite).toHaveBeenCalledWith("users/owner-1/assets/object-1");
    expect(container.querySelectorAll("[data-storage-object]")).toHaveLength(1);
    expect(Array.from(container.querySelectorAll("button")).some((button) => /delete|protect/i.test(button.textContent ?? ""))).toBe(false);
    expect(fetchMock.mock.calls.every(([url, options]) => String(url).includes("/inventory") && (!options || options.method === undefined || options.method === "GET"))).toBe(true);
  });

  it("shows empty state", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ scope: "owner", items: [], hasMore: false }) });
    await act(async () => {
      root.render(renderInventory());
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("No managed Storage objects yet.");
  });

  it("shows an initial error with retry", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    await act(async () => {
      root.render(renderInventory());
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Could not load Storage objects.");
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Retry")).toBe(true);
  });

  it("keeps existing rows and allows retry after a next-page failure", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ scope: "owner", items: [item()], hasMore: true, cursor: "next-page" }) })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ scope: "owner", items: [item("users/owner-1/assets/object-2")], hasMore: false }) });
    await act(async () => {
      root.render(renderInventory());
      await Promise.resolve();
      await Promise.resolve();
    });
    const loadMore = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Load more");
    await act(async () => {
      loadMore()?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Could not load the next page.");
    expect(container.querySelectorAll("[data-storage-object]")).toHaveLength(1);
    await act(async () => {
      loadMore()?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelectorAll("[data-storage-object]")).toHaveLength(2);
    expect(container.textContent).not.toContain("Could not load the next page.");
  });

  it("paginates on demand and sends the opaque cursor", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ scope: "owner", items: [item()], hasMore: true, cursor: "next-page" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ scope: "owner", items: [item("users/owner-1/assets/object-2")], hasMore: false }) });
    await act(async () => {
      root.render(renderInventory());
      await Promise.resolve();
      await Promise.resolve();
    });
    const loadMore = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Load more");
    expect(loadMore).toBeTruthy();
    await act(async () => {
      loadMore?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/managed-assets/inventory?cursor=next-page", expect.any(Object));
    expect(container.querySelectorAll("[data-storage-object]")).toHaveLength(2);
  });

  it("rejects response rows outside the authenticated owner's namespace", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scope: "owner", items: [item("users/owner-2/assets/object-1")], hasMore: false }),
    });
    await act(async () => {
      root.render(renderInventory());
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Could not load Storage objects.");
    expect(container.textContent).not.toContain("owner-2");
  });
});
