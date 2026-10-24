// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";
import { ManagedAssetAvailabilityControl } from "../src/features/custom-library/managed-asset-availability-control";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ManagedAssetAvailabilityControl", () => {
  let root: Root | undefined;

  beforeEach(() => {
    vi.mocked(getCurrentNonAnonymousUser).mockReturnValue({
      uid: "owner-1", isAnonymous: false, getIdToken: async () => "id-token",
    } as never);
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  function render(
    pathname: string | null,
    reconciliation?: { assetName: string; associations: readonly string[]; onComplete: () => void | Promise<void> },
    expectedStoreId: string | null = "test-store",
  ): HTMLDivElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<StudioI18nProvider><ManagedAssetAvailabilityControl pathname={pathname} expectedStoreId={expectedStoreId} reconciliation={reconciliation} /></StudioI18nProvider>));
    return container;
  }

  it("runs only after explicit request and displays the checked store identity", async () => {
    const request = vi.fn(async () => Response.json({ state: "available", storeId: "test-store" }));
    vi.stubGlobal("fetch", request);
    const container = render("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png");

    expect(request).not.toHaveBeenCalled();
    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Check availability");
    await act(async () => { button?.click(); });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("/api/managed-assets/availability", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer id-token", "Content-Type": "application/json" },
      body: JSON.stringify({ pathname: "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png", expectedStoreId: "test-store" }),
      cache: "no-store",
    }));
    expect(container.querySelector('[data-managed-asset-availability="available"]')?.textContent).toContain("Available");
    expect(container.textContent).toContain("test-store");
  });

  it.each([
    ["missing", "Source missing"],
    ["unknown", "Unverified"],
  ])("renders the %s result distinctly", async (state, label) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ state, storeId: "test-store" })));
    const container = render("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png");
    await act(async () => { container.querySelector("button")?.click(); });
    expect(container.textContent).toContain(label);
    expect(container.querySelector(`[data-managed-asset-availability="${state}"]`)).not.toBeNull();
  });

  it("keeps unsupported resources unverified and does not request a provider check", () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const container = render(null);
    expect(container.textContent).toContain("Unverified");
    expect(container.querySelector("button")).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("leaves a legacy reference unverified when its Store identity cannot be established", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const container = render("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png", {
      assetName: "Legacy file", associations: ["Legacy file (File)"], onComplete: vi.fn(),
    }, null);
    expect(container.textContent).toContain("Unverified");
    expect(container.querySelector("button")).toBeNull();
    await act(async () => { await Promise.resolve(); });
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps availability independent for mixed font faces", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ state: "available", storeId: "test-store" }))
      .mockResolvedValueOnce(Response.json({ state: "missing", storeId: "test-store" }));
    vi.stubGlobal("fetch", request);
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<StudioI18nProvider>
      <ManagedAssetAvailabilityControl pathname="users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.woff2" expectedStoreId="test-store" />
      <ManagedAssetAvailabilityControl pathname="users/owner-1/assets/223e4567-e89b-42d3-a456-426614174000.woff2" expectedStoreId="test-store" />
    </StudioI18nProvider>));

    const buttons = container.querySelectorAll("button");
    await act(async () => { buttons[0]?.click(); });
    await act(async () => { buttons[1]?.click(); });
    expect(container.querySelectorAll('[data-managed-asset-availability="available"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-managed-asset-availability="missing"]')).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("requires explicit confirmation and performs no reconciliation request when canceled", async () => {
    const request = vi.fn(async () => Response.json({ state: "missing", storeId: "test-store" }));
    vi.stubGlobal("fetch", request);
    const onComplete = vi.fn();
    const container = render("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png", {
      assetName: "Fixture file",
      associations: ["Fixture file (File)", "Fixture Sans · Regular · WOFF2 (Font face)"],
      onComplete,
    });

    expect(container.querySelectorAll("button")).toHaveLength(1);
    await act(async () => { container.querySelector("button")?.click(); });
    expect(container.textContent).toContain("Source missing");
    const reconcile = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Reconcile missing asset");
    expect(reconcile).toBeDefined();
    await act(async () => { reconcile?.click(); });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.parentElement?.tagName).not.toBe("SPAN");
    expect(dialog?.textContent).toContain("Fixture file");
    expect(dialog?.textContent).toContain("Fixture Sans · Regular · WOFF2 (Font face)");
    expect(dialog?.textContent).toContain("cannot restore the original bytes");
    expect(dialog?.textContent).toContain("published versions will remain unchanged");
    const cancel = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((button) => button.textContent === "Cancel");
    await act(async () => { cancel?.click(); });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("/api/managed-assets/availability", expect.anything());
    expect(onComplete).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("sends the checked store only after confirmation and reports success", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ state: "missing", storeId: "test-store" }))
      .mockResolvedValueOnce(Response.json({ alreadyReconciled: false }));
    vi.stubGlobal("fetch", request);
    const onComplete = vi.fn();
    const pathname = "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png";
    const container = render(pathname, { assetName: "Fixture file", associations: ["Fixture file (File)"], onComplete });
    await act(async () => { container.querySelector("button")?.click(); });
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Reconcile missing asset")?.click();
    });
    const dialog = container.querySelector('[role="dialog"]');
    await act(async () => {
      Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find((button) => button.textContent === "Reconcile missing asset")?.click();
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith("/api/managed-assets/reconcile", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ pathname, expectedStoreId: "test-store" }),
      cache: "no-store",
    }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Unverified");
  });

  it("never enables reconciliation for unknown availability", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ state: "unknown", storeId: "test-store" })));
    const container = render("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png", {
      assetName: "Fixture file", associations: ["Fixture file (File)"], onComplete: vi.fn(),
    });
    await act(async () => { container.querySelector("button")?.click(); });
    expect(container.textContent).toContain("Unverified");
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Reconcile missing asset")).toBe(false);
  });

  it("fails closed when the server checked a different Store than the resource URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ state: "missing", storeId: "other-store" })));
    const container = render("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png", {
      assetName: "Fixture file", associations: ["Fixture file (File)"], onComplete: vi.fn(),
    }, "test-store");
    await act(async () => { container.querySelector("button")?.click(); });
    expect(container.textContent).toContain("Unverified");
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Reconcile missing asset")).toBe(false);
  });

  it.each([
    ["an HTTP error", async () => new Response(JSON.stringify({ state: "missing", storeId: "test-store" }), { status: 503 })],
    ["a malformed response", async () => new Response("not-json", { status: 200 })],
    ["a response without a Store identity", async () => Response.json({ state: "available" })],
  ])("keeps the resource unverified after %s", async (_label, makeResponse) => {
    vi.stubGlobal("fetch", vi.fn(makeResponse));
    const container = render("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png", {
      assetName: "Fixture file", associations: ["Fixture file (File)"], onComplete: vi.fn(),
    });
    await act(async () => { container.querySelector("button")?.click(); });
    expect(container.textContent).toContain("Unverified");
    expect(container.textContent).not.toContain("Source missing");
    expect(container.textContent).not.toContain("Available");
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Reconcile missing asset")).toBe(false);
  });

  it("keeps network failures unverified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));
    const container = render("users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png");
    await act(async () => { container.querySelector("button")?.click(); });
    expect(container.textContent).toContain("Unverified");
    expect(container.textContent).not.toContain("Available");
    expect(container.textContent).not.toContain("Source missing");
  });
});
