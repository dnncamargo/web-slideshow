// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const stylesSource = readFileSync("src/app/page.module.css", "utf8");
const pageSource = readFileSync("src/app/page.tsx", "utf8");

const mocks = vi.hoisted(() => ({
  subscribeLiveCurrent: vi.fn(),
  resolvePublicPlayerUrl: vi.fn(),
}));

vi.mock("../src/features/live/live-current-read", () => ({
  subscribeLiveCurrent: mocks.subscribeLiveCurrent,
}));

vi.mock("../src/features/public-player/public-player-url", () => ({
  resolvePublicPlayerUrl: mocks.resolvePublicPlayerUrl,
}));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) =>
    createElement("svg", { "data-qr-value": value }),
}));

import Home from "../src/app/page";

type LiveState =
  | { kind: "loading" | "none" | "error" }
  | {
      kind: "active";
      live: { publicationId: string; currentVersionId: string; revision: number };
    };

describe("public root", () => {
  let container: HTMLDivElement;
  let root: Root;
  let callback: (state: LiveState) => void;
  let unsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    unsubscribe = vi.fn();
    mocks.resolvePublicPlayerUrl.mockReturnValue({
      available: true,
      baseUrl: "https://player.example.com",
    });
    mocks.subscribeLiveCurrent.mockImplementation((next: (state: LiveState) => void) => {
      callback = next;
      return unsubscribe;
    });

    await act(async () => {
      root.render(createElement(Home));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  function iframeSrc(title: string): string | null {
    return container.querySelector(`iframe[title="${title}"]`)?.getAttribute("src") ?? null;
  }

  async function emit(state: LiveState): Promise<void> {
    await act(async () => callback(state));
  }

  it("keeps the demo background for initial, loading, none, and error states", async () => {
    expect(iframeSrc("PowerShow demo presentation")).toBe("https://player.example.com/demo");
    expect(container.querySelector("[data-qr-value]")).toBeNull();

    await emit({ kind: "loading" });
    await emit({ kind: "none" });
    await emit({ kind: "error" });

    expect(iframeSrc("PowerShow demo presentation")).toBe("https://player.example.com/demo");
    expect(container.querySelector("[data-qr-value]")).toBeNull();
  });

  it("uses a contained keyed cover and the stable Watch URL QR while active", async () => {
    await emit({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 1 },
    });

    expect(iframeSrc("PowerShow demo presentation")).toBeNull();
    expect(iframeSrc("PowerShow live presentation cover")).toBe("https://player.example.com/cover");
    expect(container.textContent).toContain("WATCH LIVE");
    expect(container.querySelector("[aria-hidden=\"true\"]")).not.toBeNull();
    expect(container.querySelector("[data-qr-value]")?.getAttribute("data-qr-value")).toBe(
      "https://player.example.com/watch",
    );
  });

  it("returns to demo and removes the QR when Live ends", async () => {
    await emit({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 1 },
    });
    await emit({ kind: "none" });

    expect(iframeSrc("PowerShow demo presentation")).toBe("https://player.example.com/demo");
    expect(iframeSrc("PowerShow live presentation cover")).toBeNull();
    expect(container.querySelector("[data-qr-value]")).toBeNull();
  });

  it("unsubscribes and ignores callbacks after unmount", async () => {
    await act(async () => root.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      callback({
        kind: "active",
        live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 1 },
      });
    });
    expect(container.innerHTML).toBe("");
  });

  it("keeps the unavailable fallback and does not render a QR without Player", async () => {
    await act(async () => root.unmount());
    mocks.resolvePublicPlayerUrl.mockReturnValue({ available: false, baseUrl: null });
    root = createRoot(container);
    await act(async () => root.render(createElement(Home)));
    await emit({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 1 },
    });

    expect(container.textContent).toContain("Player unavailable");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[data-qr-value]")).toBeNull();
  });

  it("preserves the primary actions and approved immersive composition", () => {
    expect(container.textContent).toContain("PowerShow");
    expect(container.textContent).toContain("Studio");
    expect(container.textContent).toContain("Player");
    expect(stylesSource).toContain("width: min(76vw, 972px)");
    expect(stylesSource).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(stylesSource).toContain("width: max(100vw, calc(100dvh * 16 / 9))");
    expect(stylesSource).toContain("border-radius: 0");
  });

  it("uses only the neutral live read seam", () => {
    expect(pageSource).toContain("@/features/live/live-current-read");
    expect(pageSource).not.toMatch(/firebase\/database|runTransaction|update\(|set\(/);
  });
});
