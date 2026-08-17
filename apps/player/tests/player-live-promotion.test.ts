// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import { playerTestPresentation } from "./fixtures/player-presentation";

const mocks = vi.hoisted(() => ({
  loadPublishedVersion: vi.fn(),
  getRealtimeDatabaseOrNull: vi.fn(() => ({})),
  subscribeLiveCurrent: vi.fn(),
  resolveLiveIdentityMount: vi.fn(),
  subscribeLiveProjectionState: vi.fn(),
  mountPlayer: vi.fn(),
  liveHandler: undefined as
    | ((event: {
        kind: "active";
        live: {
          publicationId: string;
          currentVersionId: string;
          revision: number;
        };
      }) => void)
    | undefined,
}));

vi.mock("../src/published-presentation-loader", () => ({
  loadPublishedVersion: mocks.loadPublishedVersion,
}));

vi.mock("../src/realtime-db", () => ({
  getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull,
}));

vi.mock("../src/live-entry", () => ({
  parseEntrySearch: () => ({ logsEnabled: false }),
  subscribeLiveCurrent: mocks.subscribeLiveCurrent,
  resolveLiveIdentityMount: mocks.resolveLiveIdentityMount,
}));

vi.mock("../src/live-state", () => ({
  subscribeLiveProjectionState: mocks.subscribeLiveProjectionState,
}));

vi.mock("../src/player", () => ({
  mountPlayer: mocks.mountPlayer,
}));

function presentation(ids: string[]): Presentation {
  return {
    ...playerTestPresentation,
    slides: ids.map((id) => {
      const existing = playerTestPresentation.slides.find(
        (slide) => slide.id === id,
      );
      return (
        existing ?? { id, title: "", summary: "", speakerNotes: "", elements: [] }
      );
    }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function controller(initialIndex: number) {
  let index = initialIndex;
  return {
    destroy: vi.fn(),
    goTo: vi.fn((nextIndex: number) => {
      index = nextIndex;
    }),
    getCurrentIndex: vi.fn(() => index),
  };
}

describe("Player live version promotion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="app"></div>';

    mocks.getRealtimeDatabaseOrNull.mockReturnValue({});
    mocks.subscribeLiveCurrent.mockImplementation((_database, onEvent) => {
      mocks.liveHandler = onEvent;
      return vi.fn();
    });
    mocks.resolveLiveIdentityMount.mockImplementation(
      async (live, loadVersion) => {
        const loaded = await loadVersion(
          live.publicationId,
          live.currentVersionId,
        );
        return loaded.kind === "ok"
          ? {
              kind: "ok",
              publicationId: live.publicationId,
              activationRevision: live.revision,
              presentation: loaded.presentation,
            }
          : loaded;
      },
    );
    mocks.subscribeLiveProjectionState.mockReturnValue(vi.fn());
  });

  it("keeps V1 visible, discards stale V2, maps V3, then attaches its baseline ACK", async () => {
    const v1 = presentation(["slide-1", "slide-2", "slide-3"]);
    const v2 = deferred<{ kind: "ok"; presentation: Presentation }>();
    const v3 = deferred<{ kind: "ok"; presentation: Presentation }>();
    const firstController = controller(1);
    const promotedController = controller(0);

    mocks.mountPlayer
      .mockReturnValueOnce(firstController)
      .mockReturnValueOnce(promotedController);
    mocks.loadPublishedVersion.mockImplementation(
      (_publicationId: string, versionId: string) => {
        if (versionId === "version-1") {
          return Promise.resolve({ kind: "ok", presentation: v1 });
        }
        return versionId === "version-2" ? v2.promise : v3.promise;
      },
    );

    await import("../src/main");

    mocks.liveHandler?.({
      kind: "active",
      live: {
        publicationId: "publication-1",
        currentVersionId: "version-1",
        revision: 5,
      },
    });
    await vi.waitFor(() => expect(mocks.mountPlayer).toHaveBeenCalledTimes(1));

    mocks.liveHandler?.({
      kind: "active",
      live: {
        publicationId: "publication-1",
        currentVersionId: "version-2",
        revision: 5,
      },
    });
    mocks.liveHandler?.({
      kind: "active",
      live: {
        publicationId: "publication-1",
        currentVersionId: "version-3",
        revision: 5,
      },
    });

    expect(firstController.destroy).not.toHaveBeenCalled();

    v2.resolve({
      kind: "ok",
      presentation: presentation(["slide-1", "slide-2"]),
    });
    await Promise.resolve();
    expect(mocks.mountPlayer).toHaveBeenCalledTimes(1);

    const latest = presentation(["slide-3", "slide-1", "slide-2"]);
    v3.resolve({ kind: "ok", presentation: latest });

    await vi.waitFor(() => expect(mocks.mountPlayer).toHaveBeenCalledTimes(2));

    expect(firstController.destroy).toHaveBeenCalledOnce();
    expect(mocks.mountPlayer).toHaveBeenLastCalledWith(
      expect.anything(),
      latest,
      expect.anything(),
    );
    expect(promotedController.goTo).toHaveBeenCalledWith(2);
    expect(mocks.subscribeLiveProjectionState).toHaveBeenLastCalledWith(
      expect.anything(),
      5,
      "version-3",
      latest,
      promotedController,
      false,
    );
    expect(
      promotedController.goTo.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.subscribeLiveProjectionState.mock.invocationCallOrder[1] ?? Infinity,
    );
  });
});
