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

  function render(pathname: string | null): HTMLDivElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<StudioI18nProvider><ManagedAssetAvailabilityControl pathname={pathname} /></StudioI18nProvider>));
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
      body: JSON.stringify({ pathname: "users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.png" }),
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

  it("keeps availability independent for mixed font faces", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ state: "available", storeId: "test-store" }))
      .mockResolvedValueOnce(Response.json({ state: "missing", storeId: "test-store" }));
    vi.stubGlobal("fetch", request);
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<StudioI18nProvider>
      <ManagedAssetAvailabilityControl pathname="users/owner-1/assets/123e4567-e89b-42d3-a456-426614174000.woff2" />
      <ManagedAssetAvailabilityControl pathname="users/owner-1/assets/223e4567-e89b-42d3-a456-426614174000.woff2" />
    </StudioI18nProvider>));

    const buttons = container.querySelectorAll("button");
    await act(async () => { buttons[0]?.click(); });
    await act(async () => { buttons[1]?.click(); });
    expect(container.querySelectorAll('[data-managed-asset-availability="available"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-managed-asset-availability="missing"]')).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
