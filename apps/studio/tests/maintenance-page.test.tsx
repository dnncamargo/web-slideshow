// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildControlStatePath,
  buildPlayerStatePath,
} from "../src/features/live/live-state";
import { PLAYER_PRESENCE_PATH } from "../src/features/control/player-presence";
import { STUDIO_ROUTES } from "../src/features/app/studio-routes";

const database = { name: "maintenance-db" };
const mocks = vi.hoisted(() => ({
  onValue: vi.fn(),
  readControlLatencySnapshot: vi.fn(),
  requestPlayerClearCache: vi.fn(),
  ref: vi.fn(),
  requestPlayerReload: vi.fn(),
  requestPlayerRetry: vi.fn(),
  resolvePublicPlayerUrl: vi.fn(),
  subscribeLiveCurrent: vi.fn(),
  withPlayerLogsEnabled: vi.fn(),
}));

vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref }));
vi.mock("../src/features/control/realtime-db", () => ({
  getRealtimeDatabaseOrNull: () => database,
}));
vi.mock("../src/features/live/live-current-read", () => ({
  subscribeLiveCurrent: mocks.subscribeLiveCurrent,
}));
vi.mock("../src/features/control/player-recovery-request", () => ({
  requestPlayerClearCache: mocks.requestPlayerClearCache,
  requestPlayerReload: mocks.requestPlayerReload,
  requestPlayerRetry: mocks.requestPlayerRetry,
}));
vi.mock("../src/features/control/control-latency-snapshot", () => ({
  readControlLatencySnapshot: mocks.readControlLatencySnapshot,
}));
vi.mock("../src/features/public-player/public-player-url", () => ({
  resolvePublicPlayerUrl: mocks.resolvePublicPlayerUrl,
  withPlayerLogsEnabled: mocks.withPlayerLogsEnabled,
}));

import { MaintenancePage } from "../src/features/control/maintenance-page";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

const activeState = (
  overrides: Partial<{
    publicationId: string;
    currentVersionId: string;
    revision: number;
  }> = {},
) => ({
  kind: "active" as const,
  live: {
    publicationId: "publication-1",
    currentVersionId: "version-1",
    revision: 7,
    ...overrides,
  },
});

const presence = (
  bootId: string,
  stage: "starting" | "ready" | "load-failed" = "ready",
  connected = true,
  overrides: Partial<{
    activationRevision: number;
    currentVersionId: string;
  }> = {},
) => {
  const activationRevision = overrides.activationRevision ?? 7;
  const currentVersionId = overrides.currentVersionId ?? "version-1";
  return {
    current: {
      activationRevision,
      currentVersionId,
      bootId,
      stage,
      transitionedAt: 100,
      ...(stage === "load-failed"
        ? { errorCode: "presentation-load-failed" }
        : {}),
    },
    leases: {
      [bootId]: {
        activationRevision,
        currentVersionId,
        bootId,
        connected,
        transitionedAt: 100,
      },
    },
  };
};

describe("Maintenance page", () => {
  let container: HTMLDivElement;
  let root: Root;
  let liveCallback: (state: ReturnType<typeof activeState>) => void;
  let liveUnsubscribe: ReturnType<typeof vi.fn>;
  let callbacks: Map<string, (snapshot: { val(): unknown }) => void>;
  let unsubscribes: ReturnType<typeof vi.fn>[];

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = new Map();
    unsubscribes = [];
    liveUnsubscribe = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.onValue.mockImplementation(
      (
        reference: { path: string },
        callback: (snapshot: { val(): unknown }) => void,
      ) => {
        callbacks.set(reference.path, callback);
        const unsubscribe = vi.fn();
        unsubscribes.push(unsubscribe);
        return unsubscribe;
      },
    );
    mocks.subscribeLiveCurrent.mockImplementation((onState) => {
      liveCallback = onState;
      onState(activeState());
      return liveUnsubscribe;
    });
    mocks.readControlLatencySnapshot.mockReturnValue(null);
    mocks.requestPlayerReload.mockResolvedValue({});
    mocks.requestPlayerClearCache.mockResolvedValue({});
    mocks.requestPlayerRetry.mockResolvedValue({});
    mocks.resolvePublicPlayerUrl.mockReturnValue({
      available: true,
      baseUrl: "https://player.example/",
    });
    mocks.withPlayerLogsEnabled.mockReturnValue("https://player.example/?logs=true");
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  function render(): void {
    act(() => root.render(<MaintenancePage />));
  }

  function emit(path: string, value: unknown): void {
    const callback = callbacks.get(path);
    if (!callback) {
      throw new Error(`No RTDB callback registered for ${path}`);
    }
    act(() => callback({ val: () => value }));
  }

  function emitPresence(value: unknown): void {
    emit(PLAYER_PRESENCE_PATH, value);
  }

  function button(label: string): HTMLButtonElement {
    const match = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (candidate) => candidate.textContent === label,
    );
    if (!match) {
      throw new Error(`Button not found: ${label}`);
    }
    return match;
  }

  it("renders one semantic tree with Player status before Recovery", () => {
    render();

    const sections = container.querySelectorAll("main section");
    expect(sections).toHaveLength(2);
    expect(sections[0]?.querySelector("h2")?.textContent).toBe("Player status");
    expect(sections[1]?.querySelector("h2")?.textContent).toBe("Recovery");
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelectorAll<HTMLButtonElement>("button")).toHaveLength(3);
  });

  it("opens the public Player logs URL in a new tab", () => {
    render();

    const link = [...container.querySelectorAll<HTMLAnchorElement>("a")].find(
      (candidate) => candidate.textContent === "Open Player with logs",
    );
    expect(link?.getAttribute("href")).toBe("https://player.example/?logs=true");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noreferrer");
    expect(mocks.withPlayerLogsEnabled).toHaveBeenCalledWith(
      "https://player.example/",
    );
  });

  it("shows a disabled logs action without a Player href when unavailable", () => {
    mocks.resolvePublicPlayerUrl.mockReturnValue({ available: false, baseUrl: null });
    render();

    expect(button("Open Player with logs").disabled).toBe(true);
    expect(
      [...container.querySelectorAll<HTMLAnchorElement>("a")].some(
        (candidate) => candidate.textContent === "Open Player with logs",
      ),
    ).toBe(false);
  });

  it("uses the canonical Control suite chrome and one maintenance back navigation action", () => {
    render();

    const topbar = container.querySelector("main > header");
    expect(topbar).not.toBeNull();
    expect(topbar?.textContent).toContain("PowerShow");
    expect(topbar?.textContent).toContain("Control");
    expect(container.querySelector("main h1")?.textContent).toBe(
      "Maintenance & Diagnostics",
    );
    expect(container.querySelectorAll("main > header a")).toHaveLength(1);
    const back = container.querySelector<HTMLAnchorElement>("main > header a");
    expect(back?.textContent).toBe("<<< Back to presentation");
    expect(back?.getAttribute("href")).toBe(STUDIO_ROUTES.control);
    expect(topbar?.nextElementSibling?.querySelector("h1")?.textContent).toBe(
      "Maintenance & Diagnostics",
    );
  });

  it("disables every recovery action with no report and reload while disconnected", () => {
    render();
    emitPresence(null);

    expect(container.textContent).toContain("No Player report");
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].every(
        (candidate) => candidate.disabled,
      ),
    ).toBe(true);

    emitPresence(presence("boot-a", "ready", false));

    expect(container.textContent).toContain("Player disconnected");
    expect(button("Reload Player").disabled).toBe(true);
  });

  it("enables only Reload Player for an exact connected current Player", () => {
    render();
    emitPresence(presence("boot-a"));

    expect(button("Try presentation again").disabled).toBe(true);
    expect(button("Reload Player").disabled).toBe(false);
    expect(button("Clear cache and reload").disabled).toBe(false);
  });

  it("requires confirmation, writes clear-cache exactly, and waits for a replacement boot", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render();
    emitPresence(presence("boot-a", "ready"));

    await act(async () => button("Clear cache and reload").click());

    expect(confirm).toHaveBeenCalledWith("Clear the Player browser cache and reload?");
    expect(mocks.requestPlayerClearCache).toHaveBeenCalledWith(database, 7, "version-1", "boot-a");
    expect(container.textContent).toContain("Waiting for Player…");

    emitPresence(presence("boot-a", "ready"));
    expect(container.textContent).toContain("Waiting for Player…");
    emitPresence(presence("boot-b", "load-failed"));
    expect(container.textContent).not.toContain("Waiting for Player…");
    confirm.mockRestore();
  });

  it("does not write when clear-cache confirmation is cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render();
    emitPresence(presence("boot-a", "load-failed"));
    await act(async () => button("Clear cache and reload").click());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(mocks.requestPlayerClearCache).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("enables Try presentation again only for a connected load failure", () => {
    render();
    emitPresence(presence("boot-a", "load-failed"));

    expect(button("Try presentation again").disabled).toBe(false);
    expect(button("Reload Player").disabled).toBe(false);

    emitPresence(presence("boot-a", "starting"));
    expect(button("Try presentation again").disabled).toBe(true);
    emitPresence(presence("boot-a", "ready"));
    expect(button("Try presentation again").disabled).toBe(true);
  });

  it("writes retry and completes only after the same boot reports starting then ready", async () => {
    render();
    emitPresence(presence("boot-a", "load-failed"));

    await act(async () => button("Try presentation again").click());

    expect(mocks.requestPlayerRetry).toHaveBeenCalledWith(
      database,
      7,
      "version-1",
      "boot-a",
    );
    expect(container.textContent).toContain("Trying again…");

    emitPresence(presence("boot-a", "starting"));
    expect(container.textContent).toContain("Trying again…");
    emitPresence(presence("boot-a", "ready"));
    expect(container.textContent).not.toContain("Trying again…");
  });

  it("keeps retry pending through failure and allows another explicit retry", async () => {
    render();
    emitPresence(presence("boot-a", "load-failed"));
    await act(async () => button("Try presentation again").click());
    emitPresence(presence("boot-a", "starting"));
    emitPresence(presence("boot-a", "load-failed"));

    expect(container.textContent).not.toContain("Trying again…");
    expect(button("Try presentation again").disabled).toBe(false);
  });

  it("writes the exact reload target and waits for a different ready boot", async () => {
    const write = deferred<unknown>();
    mocks.requestPlayerReload.mockReturnValue(write.promise);
    render();
    emitPresence(presence("boot-a"));

    act(() => button("Reload Player").click());

    expect(mocks.requestPlayerReload).toHaveBeenCalledTimes(1);
    expect(mocks.requestPlayerReload).toHaveBeenCalledWith(
      database,
      7,
      "version-1",
      "boot-a",
    );
    expect(button("Requesting reload…").disabled).toBe(true);

    await act(async () => write.resolve({}));

    expect(container.textContent).toContain("Waiting for Player…");
    expect(button("Reload Player").disabled).toBe(true);

    emitPresence(presence("boot-a", "ready"));
    expect(container.textContent).toContain("Waiting for Player…");

    emitPresence(presence("boot-b", "starting"));
    expect(container.textContent).toContain("Waiting for Player…");

    emitPresence(presence("boot-b", "ready"));
    expect(container.textContent).not.toContain("Waiting for Player…");
    expect(button("Reload Player").disabled).toBe(false);
  });

  it("clears pending on a different failed boot while keeping failure primary", async () => {
    render();
    emitPresence(presence("boot-a"));
    await act(async () => button("Reload Player").click());
    expect(container.textContent).toContain("Waiting for Player…");

    emitPresence(presence("boot-b", "load-failed"));

    expect(container.textContent).not.toContain("Waiting for Player…");
    expect(container.textContent).toContain("Player load failed");
  });

  it("clears rejected writes, shows an alert, and allows retry", async () => {
    mocks.requestPlayerReload.mockRejectedValue(new Error("denied"));
    render();
    emitPresence(presence("boot-a"));

    await act(async () => button("Reload Player").click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not request Player reload. Try again.",
    );
    expect(button("Reload Player").disabled).toBe(false);
    expect(container.textContent).not.toContain("Waiting for Player…");

    act(() =>
      liveCallback(
        activeState({ currentVersionId: "version-2", revision: 8 }),
      ),
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("resets recovery state on identity changes and ignores stale completion", async () => {
    const oldWrite = deferred<unknown>();
    mocks.requestPlayerReload.mockReturnValue(oldWrite.promise);
    render();
    emitPresence(presence("boot-a"));
    act(() => button("Reload Player").click());
    expect(container.textContent).toContain("Requesting reload…");

    act(() =>
      liveCallback(
        activeState({ currentVersionId: "version-2", revision: 8 }),
      ),
    );

    expect(container.textContent).not.toContain("Requesting reload…");
    expect(container.querySelector('[role="alert"]')).toBeNull();

    await act(async () => oldWrite.resolve({}));

    expect(container.textContent).not.toContain("Waiting for Player…");
  });

  it("shows matching rounded latency and current slide-state evidence", () => {
    mocks.readControlLatencySnapshot.mockReturnValue({
      publicationId: "publication-1",
      activationRevision: 7,
      currentVersionId: "version-1",
      latencyMs: 45.6,
      measuredAt: 1000,
    });
    render();
    emit(buildControlStatePath(), {
      activationRevision: 7,
      currentVersionId: "version-1",
      revision: 3,
      pageId: "slide-1",
    });
    emit(buildPlayerStatePath(), {
      activationRevision: 7,
      currentVersionId: "version-1",
      appliedControlRevision: 3,
      pageId: "slide-1",
      pageIndex: 0,
    });

    expect(mocks.readControlLatencySnapshot).toHaveBeenCalledWith({
      publicationId: "publication-1",
      activationRevision: 7,
      currentVersionId: "version-1",
    });
    expect(container.textContent).toContain("Slide state synced");
    expect(container.textContent).toContain("Last slide latency46 ms");
  });

  it("shows the tab-local unmeasured wording for a missing or mismatched snapshot", () => {
    render();

    expect(container.textContent).toContain(
      "Last slide latencyNot measured in this Control tab",
    );
  });

  it("cleans subscriptions and ignores stale callbacks and writes after unmount", async () => {
    const write = deferred<unknown>();
    mocks.requestPlayerReload.mockReturnValue(write.promise);
    render();
    emitPresence(presence("boot-a"));
    act(() => button("Reload Player").click());
    const staleLiveCallback = liveCallback;
    const stalePresenceCallback = callbacks.get(PLAYER_PRESENCE_PATH);

    await act(async () => root.unmount());
    root = createRoot(container);

    expect(liveUnsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribes).toHaveLength(3);
    expect(unsubscribes.every((unsubscribe) => unsubscribe.mock.calls.length === 1)).toBe(
      true,
    );

    expect(() => {
      staleLiveCallback(activeState({ revision: 8 }));
      stalePresenceCallback?.({ val: () => presence("boot-b") });
    }).not.toThrow();
    await act(async () => {
      write.resolve({});
      await write.promise;
    });
  });
});
