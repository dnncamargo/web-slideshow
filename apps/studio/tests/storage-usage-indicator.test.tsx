// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  user: { uid: "owner-1", getIdToken: vi.fn(async () => "opaque-token") },
}));

vi.mock("../src/features/auth/studio-auth-provider", () => ({
  useStudioAuth: () => ({ user: authMocks.user }),
}));

import { StudioI18nProvider, useStudioI18n } from "../src/features/i18n/studio-i18n-context";
import { StorageUsageIndicator } from "../src/features/library/storage-usage-indicator";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function LocaleSetter({ locale }: { locale: "en" | "pt-BR" }) {
  const { setLocale } = useStudioI18n();
  useEffect(() => setLocale(locale), [locale, setLocale]);
  return null;
}

function renderIndicator(locale: "en" | "pt-BR" = "en") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <StudioI18nProvider>
        <LocaleSetter locale={locale} />
        <StorageUsageIndicator enabled />
      </StudioI18nProvider>,
    );
  });
  return { host, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StorageUsageIndicator", () => {
  it("shows loading and then a measured ready state", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => { resolve = r; })));
    const { host, root } = renderIndicator();
    await act(async () => {});
    expect(host.textContent).toContain("Loading storage usage");

    await act(async () => {
      resolve(new Response(JSON.stringify({
        scope: "owner",
        objectCount: 2,
        bytesUsed: 2048,
        measuredAt: "2026-01-01T00:00:00.000Z",
        quotaStatus: "unknown",
      }), { status: 200 }));
    });
    expect(host.textContent).toContain("2 KB used");
    expect(host.textContent).toContain("2 objects");
    expect(host.textContent).toContain("Limit unavailable");
    expect(authMocks.user.getIdToken).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("shows an unavailable state without blocking the surrounding UI", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const { host, root } = renderIndicator("pt-BR");
    await act(async () => {});
    expect(host.textContent).toContain("Uso do armazenamento indisponível");
    expect(host.querySelector("aside")?.getAttribute("data-state")).toBe("unavailable");
    act(() => root.unmount());
  });
});
