// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  mountPlayer: vi.fn(),
  recordPlayerDiagnostic: vi.fn(),
  resolveLiveIdentityMount: vi.fn(),
  startPlayerPresence: vi.fn(),
  subscribeLiveCurrent: vi.fn(),
  subscribeLiveFullscreenRequest: vi.fn(),
  subscribeLiveGalleryControl: vi.fn(),
  subscribeLiveProjectionState: vi.fn(),
}));

vi.mock("../src/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull }));
vi.mock("../src/live-entry", () => ({
  parseEntrySearch: () => ({ logsEnabled: false }),
  resolveLiveIdentityMount: mocks.resolveLiveIdentityMount,
  subscribeLiveCurrent: mocks.subscribeLiveCurrent,
}));
vi.mock("../src/live-player-presence", () => ({ startPlayerPresence: mocks.startPlayerPresence }));
vi.mock("../src/live-state", () => ({ subscribeLiveProjectionState: mocks.subscribeLiveProjectionState }));
vi.mock("../src/live-fullscreen-request", () => ({ subscribeLiveFullscreenRequest: mocks.subscribeLiveFullscreenRequest }));
vi.mock("../src/live-gallery-control", () => ({ subscribeLiveGalleryControl: mocks.subscribeLiveGalleryControl }));
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
    mocks.startPlayerPresence.mockResolvedValue({ ready, failed: vi.fn(), stop });
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
});
