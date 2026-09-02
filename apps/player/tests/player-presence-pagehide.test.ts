// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  mountPlayer: vi.fn(),
  recordPlayerDiagnostic: vi.fn(),
  readLiveCurrent: vi.fn(),
  resolveLiveIdentityMount: vi.fn(),
  startPlayerPresence: vi.fn(),
  subscribeLiveCurrent: vi.fn(),
  subscribeLiveFullscreenRequest: vi.fn(),
  subscribeLiveGalleryControl: vi.fn(),
  subscribeLiveProjectionState: vi.fn(),
  subscribePlayerRecoveryRequest: vi.fn(),
}));

vi.mock("../src/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull }));
vi.mock("../src/live-entry", () => ({
  parseEntrySearch: () => ({ logsEnabled: false }),
  readLiveCurrent: mocks.readLiveCurrent,
  resolveLiveIdentityMount: mocks.resolveLiveIdentityMount,
  subscribeLiveCurrent: mocks.subscribeLiveCurrent,
}));
vi.mock("../src/live-player-presence", () => ({ startPlayerPresence: mocks.startPlayerPresence }));
vi.mock("../src/live-state", () => ({ subscribeLiveProjectionState: mocks.subscribeLiveProjectionState }));
vi.mock("../src/live-fullscreen-request", () => ({ subscribeLiveFullscreenRequest: mocks.subscribeLiveFullscreenRequest }));
vi.mock("../src/live-gallery-control", () => ({ subscribeLiveGalleryControl: mocks.subscribeLiveGalleryControl }));
vi.mock("../src/live-player-recovery-request", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/live-player-recovery-request")>()),
  subscribePlayerRecoveryRequest: mocks.subscribePlayerRecoveryRequest,
}));
vi.mock("../src/live-version-mapping", () => ({ mapPromotedSlideIndex: () => 0 }));
vi.mock("../src/published-presentation-loader", () => ({ loadPublishedVersion: vi.fn() }));
vi.mock("../src/player-diagnostics", () => ({ configurePlayerDiagnostics: vi.fn(), recordPlayerDiagnostic: mocks.recordPlayerDiagnostic }));
vi.mock("../src/player", () => ({ mountPlayer: mocks.mountPlayer }));

import { startPlayer } from "../src/player-entry";

describe("Player presence pagehide cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="app"></div>';
    mocks.getRealtimeDatabaseOrNull.mockReturnValue({});
    mocks.subscribeLiveProjectionState.mockReturnValue(vi.fn());
    mocks.subscribeLiveFullscreenRequest.mockReturnValue(vi.fn());
    mocks.subscribeLiveGalleryControl.mockReturnValue(vi.fn());
    mocks.subscribePlayerRecoveryRequest.mockReturnValue(vi.fn());
    mocks.readLiveCurrent.mockResolvedValue({
      kind: "ok",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 7 },
    });
    mocks.mountPlayer.mockReturnValue({ destroy: vi.fn(), getCurrentIndex: () => 0, goTo: vi.fn() });
  });

  it("stops transitions on pagehide without owning disconnect cancellation", async () => {
    const stop = vi.fn();
    const ready = vi.fn();
    let handleLive!: (event: unknown) => void;
    mocks.subscribeLiveCurrent.mockImplementation((_database, handler) => {
      handleLive = handler;
      return vi.fn();
    });
    mocks.startPlayerPresence.mockResolvedValue({ starting: vi.fn(), ready, failed: vi.fn(), stop });
    mocks.resolveLiveIdentityMount.mockResolvedValue({ kind: "ok", presentation: { slides: [] } });

    startPlayer(document.querySelector("#app")!);
    handleLive({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 7 },
    });

    await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event("pagehide"));

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("sanitizes initialization rejection without interrupting presentation rendering", async () => {
    let handleLive!: (event: unknown) => void;
    const failure = new Error("presence denied");
    mocks.subscribeLiveCurrent.mockImplementation((_database, handler) => {
      handleLive = handler;
      return vi.fn();
    });
    mocks.startPlayerPresence.mockRejectedValue(failure);
    mocks.resolveLiveIdentityMount.mockResolvedValue({ kind: "ok", presentation: { slides: [] } });

    startPlayer(document.querySelector("#app")!);
    handleLive({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 7 },
    });

    await vi.waitFor(() => expect(mocks.mountPlayer).toHaveBeenCalledTimes(1));
    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_PRESENCE_WRITE_ERROR",
      { transition: "starting", error: failure },
    );
  });

  it("keeps presence and loading valid when recovery subscription setup fails synchronously", async () => {
    const ready = vi.fn();
    const failure = new Error("recovery subscription unavailable");
    let handleLive!: (event: unknown) => void;
    mocks.subscribeLiveCurrent.mockImplementation((_database, handler) => {
      handleLive = handler;
      return vi.fn();
    });
    mocks.startPlayerPresence.mockResolvedValue({
      bootId: "boot-a",
      starting: vi.fn(),
      ready,
      failed: vi.fn(),
      stop: vi.fn(),
    });
    mocks.subscribePlayerRecoveryRequest.mockImplementation(() => {
      throw failure;
    });
    mocks.resolveLiveIdentityMount.mockResolvedValue({
      kind: "ok",
      presentation: { slides: [] },
    });

    startPlayer(document.querySelector("#app")!);
    handleLive({
      kind: "active",
      live: {
        publicationId: "publication-1",
        currentVersionId: "version-1",
        revision: 7,
      },
    });

    await vi.waitFor(() => expect(mocks.mountPlayer).toHaveBeenCalledTimes(1));
    expect(ready).toHaveBeenCalledTimes(1);
    expect(mocks.resolveLiveIdentityMount).toHaveBeenCalledTimes(1);
    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_RECOVERY_SUBSCRIBE_ERROR",
      { error: failure },
    );
    expect(mocks.recordPlayerDiagnostic).not.toHaveBeenCalledWith(
      "PLAYER_PRESENCE_WRITE_ERROR",
      expect.anything(),
    );
  });

  it("retries the shared loading path in the same boot and restores projections", async () => {
    const starting = vi.fn();
    const ready = vi.fn();
    const failed = vi.fn();
    const projectionCleanups = [vi.fn(), vi.fn()];
    let recoveryHandler!: (request: unknown) => void;
    let loadCount = 0;
    let handleLive!: (event: unknown) => void;
    mocks.subscribeLiveCurrent.mockImplementation((_database, handler) => {
      handleLive = handler;
      return vi.fn();
    });
    mocks.startPlayerPresence.mockResolvedValue({
      bootId: "boot-a",
      starting,
      ready,
      failed,
      stop: vi.fn(),
    });
    mocks.resolveLiveIdentityMount.mockImplementation(async () => {
      loadCount += 1;
      return loadCount === 1
        ? { kind: "error" }
        : { kind: "ok", presentation: { slides: [] } };
    });
    mocks.subscribePlayerRecoveryRequest.mockImplementation(
      (_db, _revision, _version, _boot, _location, _navigation, onRetry) => {
        recoveryHandler = () => void onRetry();
        return vi.fn();
      },
    );
    mocks.subscribeLiveProjectionState
      .mockReturnValueOnce(projectionCleanups[0])
      .mockReturnValueOnce(projectionCleanups[1]);

    startPlayer(document.querySelector("#app")!);
    handleLive({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 7 },
    });
    await vi.waitFor(() => expect(failed).toHaveBeenCalledWith("presentation-load-failed"));

    recoveryHandler({ action: "retry" });
    await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(1));

    expect(starting).toHaveBeenCalledTimes(1);
    expect(mocks.resolveLiveIdentityMount).toHaveBeenCalledTimes(2);
    expect(mocks.mountPlayer).toHaveBeenCalledTimes(1);

    recoveryHandler({ action: "retry" });
    await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(2));
    expect(starting).toHaveBeenCalledTimes(2);
    expect(mocks.resolveLiveIdentityMount).toHaveBeenCalledTimes(3);
    expect(mocks.mountPlayer).toHaveBeenCalledTimes(2);
    expect(projectionCleanups[0]).toHaveBeenCalledTimes(1);
    expect(mocks.recordPlayerDiagnostic).not.toHaveBeenCalledWith(
      "PLAYER_RECOVERY_RETRY_ERROR",
      expect.anything(),
    );
  });

  it("keeps fatal recovery options collapsed until requested and collapses with See less", async () => {
    let handleLive!: (event: unknown) => void;
    mocks.subscribeLiveCurrent.mockImplementation((_database, handler) => {
      handleLive = handler;
      return vi.fn();
    });
    mocks.startPlayerPresence.mockResolvedValue({
      bootId: "boot-a",
      starting: vi.fn(),
      ready: vi.fn(),
      failed: vi.fn(),
      stop: vi.fn(),
    });
    mocks.resolveLiveIdentityMount.mockResolvedValue({ kind: "error" });

    startPlayer(document.querySelector("#app")!);
    handleLive({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 7 },
    });

    await vi.waitFor(() => expect(document.body.textContent).toContain("See more"));
    const more = document.querySelector<HTMLButtonElement>(
      ".powershow-player-recovery-toggle",
    );
    expect(more?.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.textContent).not.toContain("Try presentation again");
    expect(document.body.textContent).not.toContain("raw-error");

    more?.click();
    expect(document.body.textContent).toContain("Try presentation again");
    expect(document.body.textContent).toContain("Reload Player");
    expect(document.body.textContent).toContain("Clear cache and reload");
    expect(document.body.textContent).toContain("Error code: FIRESTORE_LOAD_ERROR");
    expect(document.body.textContent).toContain("Stage: Published presentation");
    expect(more?.getAttribute("aria-expanded")).toBe("true");

    more?.click();
    expect(document.body.textContent).toContain("See more");
    expect(document.body.textContent).not.toContain("Try presentation again");
  });

  it("leaves the no-active surface unchanged", () => {
    let handleLive!: (event: unknown) => void;
    mocks.subscribeLiveCurrent.mockImplementation((_database, handler) => {
      handleLive = handler;
      return vi.fn();
    });

    startPlayer(document.querySelector("#app")!);
    handleLive({ kind: "no-active" });

    expect(document.body.textContent).toContain("No active presentation.");
    expect(document.body.textContent).not.toContain("See more");
    expect(document.body.textContent).not.toContain("Try presentation again");
  });

  it("performs a local retry in the current boot and suppresses duplicates", async () => {
    let handleLive!: (event: unknown) => void;
    let resolveRetry!: (result: unknown) => void;
    let loadCount = 0;
    mocks.subscribeLiveCurrent.mockImplementation((_database, handler) => {
      handleLive = handler;
      return vi.fn();
    });
    mocks.startPlayerPresence.mockResolvedValue({
      bootId: "boot-a",
      starting: vi.fn(),
      ready: vi.fn(),
      failed: vi.fn(),
      stop: vi.fn(),
    });
    mocks.resolveLiveIdentityMount.mockImplementation(() => {
      loadCount += 1;
      if (loadCount === 1) return Promise.resolve({ kind: "error" });
      return new Promise((resolve) => {
        resolveRetry = resolve;
      });
    });

    startPlayer(document.querySelector("#app")!);
    handleLive({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 7 },
    });
    await vi.waitFor(() => expect(document.body.textContent).toContain("See more"));
    document.querySelector<HTMLButtonElement>(".powershow-player-recovery-toggle")?.click();

    const retry = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Try presentation again",
    );
    retry?.click();
    retry?.click();

    await vi.waitFor(() => expect(mocks.resolveLiveIdentityMount).toHaveBeenCalledTimes(2));
    expect(mocks.resolveLiveIdentityMount).toHaveBeenCalledTimes(2);
    expect(mocks.recordPlayerDiagnostic).not.toHaveBeenCalledWith(
      "PLAYER_RECOVERY_RETRY_ERROR",
      expect.anything(),
    );

    resolveRetry({ kind: "ok", presentation: { slides: [] } });
    await vi.waitFor(() => expect(mocks.mountPlayer).toHaveBeenCalledTimes(1));
  });

  async function showRecoveryOptions(options: {
    resolveMount?: () => Promise<unknown>;
    presence?: unknown;
  } = {}): Promise<void> {
    let handleLive!: (event: unknown) => void;
    mocks.subscribeLiveCurrent.mockImplementation((_database, handler) => {
      handleLive = handler;
      return vi.fn();
    });
    mocks.startPlayerPresence.mockResolvedValue(options.presence ?? {
      bootId: "boot-a",
      starting: vi.fn(),
      ready: vi.fn(),
      failed: vi.fn(),
      stop: vi.fn(),
    });
    mocks.resolveLiveIdentityMount.mockImplementation(
      options.resolveMount ?? (() => Promise.resolve({ kind: "error" })),
    );

    startPlayer(document.querySelector("#app")!);
    handleLive({
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 7 },
    });
    await vi.waitFor(() => expect(document.body.textContent).toContain("See more"));
    document.querySelector<HTMLButtonElement>(".powershow-player-recovery-toggle")?.click();
  }

  function recoveryButton(label: string): HTMLButtonElement {
    const button = [...document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === label,
    );
    expect(button).toBeInstanceOf(HTMLButtonElement);
    return button as HTMLButtonElement;
  }

  function stubPlayerWindow(href: string): {
    replace: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
  } {
    const navigation = { replace: vi.fn() };
    const confirm = vi.fn();
    const location = new URL(href);
    const playerWindow = Object.create(window) as Window & typeof globalThis;
    Object.defineProperties(playerWindow, {
      location: { configurable: true, value: location },
      confirm: { configurable: true, value: confirm },
      addEventListener: { configurable: true, value: window.addEventListener.bind(window) },
    });
    Object.defineProperty(playerWindow.location, "replace", {
      configurable: true,
      value: navigation.replace,
    });
    vi.stubGlobal("window", playerWindow);
    return { replace: navigation.replace, confirm };
  }

  it("uses the local reload contract and preserves the current URL", async () => {
    const { replace } = stubPlayerWindow(
      "https://player.example/live?logs=true&mode=preview&_psreload=old#slide-2",
    );

    try {
      await showRecoveryOptions();
      recoveryButton("Reload Player").click();

      expect(replace).toHaveBeenCalledTimes(1);
      const destination = new URL(replace.mock.calls[0]?.[0] as string);
      expect(destination.origin).toBe("https://player.example");
      expect(destination.pathname).toBe("/live");
      expect(destination.searchParams.get("logs")).toBe("true");
      expect(destination.searchParams.get("mode")).toBe("preview");
      expect(destination.searchParams.get("_psreload")).toBe("7-1");
      expect(destination.hash).toBe("#slide-2");
      expect(mocks.subscribePlayerRecoveryRequest).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("cancels cache clearing without navigation and keeps recovery usable", async () => {
    const { replace, confirm } = stubPlayerWindow("https://player.example/live?logs=true#slide-2");
    confirm.mockReturnValue(false);

    try {
      await showRecoveryOptions();
      recoveryButton("Clear cache and reload").click();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(replace).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("Try presentation again");
      expect(mocks.subscribePlayerRecoveryRequest).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the accepted cache route and preserves the safe return URL", async () => {
    const { replace, confirm } = stubPlayerWindow(
      "https://player.example/watch?logs=true&mode=preview&_psreload=old#slide-2",
    );
    confirm.mockReturnValue(true);

    try {
      await showRecoveryOptions();
      recoveryButton("Clear cache and reload").click();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledTimes(1);
      const destination = new URL(replace.mock.calls[0]?.[0] as string);
      expect(destination.origin).toBe("https://player.example");
      expect(destination.pathname).toBe("/__powershow/clear-cache");
      expect(destination.searchParams.get("return")).toBe(
        "/watch?logs=true&mode=preview&_psreload=7-1#slide-2",
      );
      expect(mocks.subscribePlayerRecoveryRequest).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns a failed local retry to the sanitized recoverable surface", async () => {
    const rawFailure = new Error(
      "raw-error stack-token secret-token /firestore/presentations/presentation-99",
    );
    const starting = vi.fn();
    const failed = vi.fn();
    let loadCount = 0;
    await showRecoveryOptions({
      resolveMount: () => {
        loadCount += 1;
        return loadCount === 1
          ? Promise.resolve({ kind: "error" })
          : Promise.reject(rawFailure);
      },
      presence: {
        bootId: "boot-a",
        starting,
        ready: vi.fn(),
        failed,
        stop: vi.fn(),
      },
    });
    recoveryButton("Try presentation again").click();

    await vi.waitFor(() => expect(document.body.textContent).toContain("See more"));
    expect(starting).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledWith("presentation-load-failed");
    expect(document.body.textContent).toContain("Could not load presentation.");
    document.querySelector<HTMLButtonElement>(".powershow-player-recovery-toggle")?.click();
    expect(document.body.textContent).toContain("Error code: FIRESTORE_LOAD_ERROR");
    expect(document.body.textContent).toContain("Stage: Published presentation");
    expect(document.body.textContent).not.toContain("raw-error");
    expect(document.body.textContent).not.toContain("stack-token");
    expect(document.body.textContent).not.toContain("secret-token");
    expect(document.body.textContent).not.toContain("/firestore/presentations/presentation-99");
    expect(document.body.textContent).not.toContain("publication-1");
    expect(document.body.textContent).not.toContain("version-1");
    expect(recoveryButton("Try presentation again").disabled).toBe(false);
    expect(recoveryButton("See less")).toBeTruthy();
  });
});
