import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COALESCE_DELAY_MS,
  LiveControl,
  type LiveControlView,
} from "../src/features/control/live-control";

function controlState(
  overrides: Partial<{
    activationRevision: number;
    currentVersionId: string;
    revision: number;
    pageId: string;
  }> = {},
) {
  return {
    activationRevision: 1,
    currentVersionId: "version-1",
    revision: 1,
    pageId: "page-a",
    ...overrides,
  };
}

function playerState(
  overrides: Partial<{
    activationRevision: number;
    currentVersionId: string;
    appliedControlRevision: number;
    pageId: string;
    pageIndex: number;
  }> = {},
) {
  return {
    activationRevision: 1,
    currentVersionId: "version-1",
    appliedControlRevision: 0,
    pageId: "page-a",
    pageIndex: 0,
    ...overrides,
  };
}

function createHarness() {
  const livePageIds = ["page-a", "page-b", "page-c", "page-d"];
  let currentTime = 0;
  const views: LiveControlView[] = [];
  const writeControlState = vi.fn();

  const control = new LiveControl({
    activationRevision: 1,
    currentVersionId: "version-1",
    resolvePageId: (pageIndex) => livePageIds[pageIndex] ?? null,
    resolvePageIndex: (pageId) => {
      const index = livePageIds.findIndex((id) => id === pageId);
      return index >= 0 ? index : null;
    },
    writeControlState,
    now: () => currentTime,
    schedule: (callback, delay) => {
      const id = setTimeout(callback, delay);
      return () => clearTimeout(id);
    },
    onViewChange: (view) => views.push(view),
    onCommandError: vi.fn(),
  });

  return {
    control,
    views,
    writeControlState,
    advance(ms: number) {
      currentTime += ms;
      vi.advanceTimersByTime(ms);
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe("LiveControl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates from the Player baseline state", () => {
    const h = createHarness();

    h.control.handlePlayerState(playerState());

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      desiredPageId: "page-a",
      desiredPageIndex: 0,
      actualPageId: "page-a",
      actualPageIndex: 0,
    });
    expect(h.views.at(-1)?.status).toEqual({ kind: "synced" });
  });

  it("reconstructs desired and actual state regardless of callback order", () => {
    const first = createHarness();

    first.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );
    first.control.handlePlayerState(
      playerState({
        appliedControlRevision: 7,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    expect(first.views.at(-1)).toMatchObject({
      enabled: true,
      desiredPageId: "page-b",
      desiredPageIndex: 1,
      actualPageId: "page-a",
      actualPageIndex: 0,
    });
    expect(first.views.at(-1)?.status).toEqual({ kind: "syncing" });
    expect(first.writeControlState).not.toHaveBeenCalled();

    const second = createHarness();

    second.control.handlePlayerState(
      playerState({
        appliedControlRevision: 7,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );
    second.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );

    expect(second.views.at(-1)).toMatchObject({
      enabled: true,
      desiredPageId: "page-b",
      desiredPageIndex: 1,
      actualPageId: "page-a",
      actualPageIndex: 0,
    });
    expect(second.views.at(-1)?.status).toEqual({ kind: "syncing" });
    expect(second.writeControlState).not.toHaveBeenCalled();
  });

  it("treats a restarted Player baseline behind desired as syncing", () => {
    const h = createHarness();

    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-b",
        pageIndex: 1,
      }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 0,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      desiredPageId: "page-b",
      desiredPageIndex: 1,
      actualPageId: "page-a",
      actualPageIndex: 0,
    });
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });

  it("does not emit a replacement write when reloading with desired ahead of actual", () => {
    const h = createHarness();

    h.control.handlePlayerState(playerState());
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );

    expect(h.writeControlState).not.toHaveBeenCalled();
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });

  it("A: synced Next persists B while actual remains A", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handlePlayerState(playerState());

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-b",
    });

    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    await Promise.resolve();

    expect(h.views.at(-1)).toMatchObject({
      desiredPageId: "page-b",
      desiredPageIndex: 1,
      actualPageId: "page-a",
      actualPageIndex: 0,
    });
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });

  it("B: persists C while B is unconfirmed by Player", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handlePlayerState(playerState());

    h.writeControlState
      .mockResolvedValueOnce({
        activationRevision: 1,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-b",
      })
      .mockResolvedValueOnce({
        activationRevision: 1,
        currentVersionId: "version-1",
        revision: 2,
        pageId: "page-c",
      });

    h.control.next();
    h.advance(COALESCE_DELAY_MS);
    await Promise.resolve();

    // B is persisted but Player has not confirmed it.
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });

    h.control.next();
    h.advance(COALESCE_DELAY_MS);
    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledTimes(2);
    expect(h.writeControlState).toHaveBeenLastCalledWith(2);
    expect(h.views.at(-1)?.desiredPageId).toBe("page-c");
    expect(h.views.at(-1)?.actualPageId).toBe("page-a");
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });

  it("C: B -> C -> D navigation while Player is stale keeps latest desired", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handlePlayerState(playerState());

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-d",
    });

    h.control.next();
    h.control.next();
    h.control.next();

    h.advance(COALESCE_DELAY_MS);

    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(3);
    expect(h.views.at(-1)?.desiredPageId).toBe("page-d");
    expect(h.views.at(-1)?.actualPageId).toBe("page-a");
  });

  it("D: navigation base while syncing is latest desired, never actual", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 7,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-c",
    });

    // Must navigate from desired B to C, not from lagging actual A to B.
    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(2);
  });

  it("E: rapid input inside the window coalesces to the latest target", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handlePlayerState(playerState());

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-c",
    });

    h.control.next();
    h.advance(20);
    h.control.next();
    h.advance(20);
    h.control.next();

    h.advance(COALESCE_DELAY_MS);

    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(3);
  });

  it("F: a newer draft waits for the write to resolve, not Player confirmation", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handlePlayerState(playerState());

    const committedB =
      deferred<Awaited<ReturnType<typeof h.writeControlState>>>();
    h.writeControlState
      .mockReturnValueOnce(committedB.promise)
      .mockResolvedValueOnce({
        activationRevision: 1,
        currentVersionId: "version-1",
        revision: 2,
        pageId: "page-c",
      });

    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).toHaveBeenCalledTimes(1);

    // Navigate to C while the B write is still resolving. No second write yet.
    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });

    // The write completes; the newer draft is flushed after the coalescing
    // window without waiting for a Player confirmation of B.
    committedB.resolve({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-b",
    });

    await Promise.resolve();

    h.advance(COALESCE_DELAY_MS);
    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledTimes(2);
    expect(h.writeControlState).toHaveBeenLastCalledWith(2);
  });

  it("G: reload rev8/C + rev5/A reconstructs without a write, Next persists D", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-c" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 5,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      desiredPageId: "page-c",
      desiredPageIndex: 2,
      actualPageId: "page-a",
      actualPageIndex: 0,
    });
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
    expect(h.writeControlState).not.toHaveBeenCalled();

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-d",
    });

    h.control.next();
    h.advance(COALESCE_DELAY_MS);
    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(3);
    expect(h.views.at(-1)?.desiredPageId).toBe("page-d");
  });

  it("H: a stale/older Player confirmation does not revert desired or display", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-c" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 7,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    const committedD =
      deferred<Awaited<ReturnType<typeof h.writeControlState>>>();
    h.writeControlState.mockReturnValue(committedD.promise);

    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).toHaveBeenCalledWith(3);

    // Player confirms the older rev8/C generation while D is being written.
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-c",
        pageIndex: 2,
      }),
    );

    expect(h.views.at(-1)?.desiredPageId).toBe("page-d");
    expect(h.views.at(-1)?.actualPageId).toBe("page-c");

    committedD.resolve({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-d",
    });

    await Promise.resolve();

    expect(h.views.at(-1)?.desiredPageId).toBe("page-d");
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });

  it("I: the exact latest confirmation yields Synced", () => {
    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-c" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-c",
        pageIndex: 2,
      }),
    );

    expect(h.views.at(-1)?.status).toEqual({ kind: "synced" });
  });

  it("J: a restarted Player baseline rev0 behind desired remains Syncing", () => {
    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-c" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 0,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });

  it("K: independent Player movement yields player-changed, display stays desired", () => {
    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-c",
        pageIndex: 2,
      }),
    );

    expect(h.views.at(-1)?.status).toEqual({ kind: "player-changed" });
    expect(h.views.at(-1)?.desiredPageId).toBe("page-b");
    expect(h.views.at(-1)?.desiredPageIndex).toBe(1);
    expect(h.views.at(-1)?.actualPageId).toBe("page-c");
    expect(h.views.at(-1)?.actualPageIndex).toBe(2);
  });

  it("L: Follow Player creates a newer desired generation and converges", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-c",
        pageIndex: 2,
      }),
    );

    expect(h.views.at(-1)?.status).toEqual({ kind: "player-changed" });

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-c",
    });

    h.control.followPlayer();

    expect(h.views.at(-1)?.desiredPageId).toBe("page-c");
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });

    h.advance(COALESCE_DELAY_MS);
    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledWith(2);
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });

    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 9,
        pageId: "page-c",
        pageIndex: 2,
      }),
    );

    expect(h.views.at(-1)?.status).toMatchObject({ kind: "synced" });
  });

  it("M: Previous/Next remain operational in player-changed from the desired position", async () => {
    vi.useFakeTimers();

    const previousHarness = createHarness();
    previousHarness.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );
    previousHarness.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-c",
        pageIndex: 2,
      }),
    );

    expect(previousHarness.views.at(-1)?.status).toEqual({
      kind: "player-changed",
    });

    previousHarness.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-a",
    });

    // Previous from desired B (index 1) -> A (index 0).
    previousHarness.control.previous();
    previousHarness.advance(COALESCE_DELAY_MS);

    expect(previousHarness.writeControlState).toHaveBeenLastCalledWith(0);

    const nextHarness = createHarness();
    nextHarness.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );
    nextHarness.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-c",
        pageIndex: 2,
      }),
    );

    nextHarness.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-c",
    });

    // Next from desired B (index 1) -> C (index 2).
    nextHarness.control.next();
    nextHarness.advance(COALESCE_DELAY_MS);

    expect(nextHarness.writeControlState).toHaveBeenLastCalledWith(2);
  });

  it("N: the view exposes desired and actual positions independently while syncing", () => {
    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-c" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 5,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    const view = h.views.at(-1);

    expect(view).toMatchObject({
      desiredPageId: "page-c",
      desiredPageIndex: 2,
      actualPageId: "page-a",
      actualPageIndex: 0,
      status: { kind: "syncing" },
    });
    expect(view?.desiredPageIndex).not.toBe(view?.actualPageIndex);
  });

  it("coalesces user input and keeps a single write in flight", () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.control.handlePlayerState(playerState());

    h.writeControlState.mockImplementation(() => new Promise(() => undefined));

    h.control.next();
    h.control.next();
    h.control.next();

    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(3);
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });

  it("goTo enters the existing coalesced navigation path", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.control.handlePlayerState(playerState());
    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-c",
    });

    h.control.goTo(2);
    h.advance(COALESCE_DELAY_MS);
    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(2);
  });

  it("goTo fails closed before a baseline, for invalid targets, and for the current target", () => {
    vi.useFakeTimers();
    const h = createHarness();

    h.control.goTo(2);
    h.control.handlePlayerState(playerState());
    h.control.goTo(-1);
    h.control.goTo(99);
    h.control.goTo(0);
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).not.toHaveBeenCalled();
  });

  it("coalesces rapid direct targets to the latest target", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.control.handlePlayerState(playerState());
    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-d",
    });

    h.control.goTo(1);
    h.control.goTo(3);
    h.advance(COALESCE_DELAY_MS);
    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(3);
  });

  it("measures latency on the matching Player confirmation", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.control.handlePlayerState(playerState());

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-b",
    });

    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    await Promise.resolve();

    h.advance(45);
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 1,
        pageId: "page-b",
        pageIndex: 1,
      }),
    );

    expect(h.views.at(-1)?.status).toEqual({
      kind: "synced",
      latencyMs: 45,
    });
  });

  it("republishes the baseline truth when the Player confirmation arrives before the writer resolves", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.control.handlePlayerState(playerState());

    const committed =
      deferred<Awaited<ReturnType<typeof h.writeControlState>>>();
    h.writeControlState.mockReturnValue(committed.promise);

    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 1,
        pageId: "page-b",
        pageIndex: 1,
      }),
    );

    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });

    committed.resolve({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-b",
    });

    await Promise.resolve();

    expect(h.views.at(-1)?.status).toEqual({
      kind: "synced",
      latencyMs: 0,
    });
  });

  it("restores the persisted baseline and reports an error when a write fails", async () => {
    vi.useFakeTimers();
    const onCommandError = vi.fn();
    let currentTime = 0;
    const views: LiveControlView[] = [];
    const writeControlState = vi.fn(async () => {
      throw new Error("boom");
    });
    const control = new LiveControl({
      activationRevision: 1,
      currentVersionId: "version-1",
      resolvePageId: (pageIndex) =>
        ["page-a", "page-b", "page-c", "page-d"][pageIndex] ?? null,
      resolvePageIndex: (pageId) =>
        ["page-a", "page-b", "page-c", "page-d"].findIndex(
          (id) => id === pageId,
        ),
      writeControlState,
      now: () => currentTime,
      schedule: (callback, delay) => {
        const id = setTimeout(callback, delay);
        return () => clearTimeout(id);
      },
      onViewChange: (view) => views.push(view),
      onCommandError,
    });

    control.handlePlayerState(playerState());

    control.next();
    currentTime += COALESCE_DELAY_MS;
    vi.advanceTimersByTime(COALESCE_DELAY_MS);

    await Promise.resolve();

    expect(onCommandError).toHaveBeenCalledTimes(1);
    expect(views.at(-1)).toMatchObject({
      enabled: true,
      desiredPageId: "page-a",
      desiredPageIndex: 0,
      actualPageId: "page-a",
      actualPageIndex: 0,
    });
    expect(views.at(-1)?.status).toEqual({ kind: "synced" });
  });

  it("ignores stale activation and version snapshots", () => {
    const h = createHarness();
    h.control.handlePlayerState(playerState());
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );

    const before = h.views.at(-1);

    h.control.handleControlState({
      activationRevision: 99,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-c",
    });
    h.control.handleControlState({
      activationRevision: 1,
      currentVersionId: "version-old",
      revision: 9,
      pageId: "page-c",
    });

    expect(h.views.at(-1)).toEqual(before);
  });

  it("does not publish new local view state after destroy while a write is in flight", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.control.handlePlayerState(playerState());

    const committed =
      deferred<Awaited<ReturnType<typeof h.writeControlState>>>();
    h.writeControlState.mockReturnValue(committed.promise);

    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    const beforeDestroyCount = h.views.length;
    h.control.destroy();

    committed.resolve({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-b",
    });

    await Promise.resolve();

    expect(h.views).toHaveLength(beforeDestroyCount);
  });

  it("classifies an independently moved Player as player-changed when revision matches", () => {
    const h = createHarness();
    h.control.handlePlayerState(playerState());
    h.control.handleControlState(
      controlState({ revision: 3, pageId: "page-b" }),
    );

    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 3,
        pageId: "page-c",
        pageIndex: 2,
      }),
    );

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      desiredPageId: "page-b",
      desiredPageIndex: 1,
      actualPageId: "page-c",
      actualPageIndex: 2,
    });
    expect(h.views.at(-1)?.status).toEqual({ kind: "player-changed" });
  });

  it("A: Follow Player resolves the canonical index from pageId, ignoring a mismatched reported pageIndex", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handleControlState(
      controlState({ revision: 8, pageId: "page-b" }),
    );
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        // Deliberately inconsistent: page-c is index 2 in the mapping.
        pageId: "page-c",
        pageIndex: 1,
      }),
    );

    expect(h.views.at(-1)?.status).toEqual({ kind: "player-changed" });

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-c",
    });

    h.control.followPlayer();
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(2);
  });

  it("B: navigation from a Player baseline uses the canonical pageId, not the reported pageIndex", async () => {
    vi.useFakeTimers();

    const previousHarness = createHarness();
    previousHarness.control.handlePlayerState(
      playerState({
        appliedControlRevision: 0,
        pageId: "page-c",
        pageIndex: 1,
      }),
    );

    expect(previousHarness.views.at(-1)).toMatchObject({
      desiredPageId: "page-c",
      desiredPageIndex: 2,
      actualPageId: "page-c",
      actualPageIndex: 2,
    });

    previousHarness.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-b",
    });

    // Previous from canonical page-c (index 2) -> page-b (index 1).
    previousHarness.control.previous();
    previousHarness.advance(COALESCE_DELAY_MS);

    expect(previousHarness.writeControlState).toHaveBeenCalledTimes(1);
    expect(previousHarness.writeControlState).toHaveBeenLastCalledWith(1);

    const nextHarness = createHarness();
    nextHarness.control.handlePlayerState(
      playerState({
        appliedControlRevision: 0,
        pageId: "page-c",
        pageIndex: 1,
      }),
    );

    nextHarness.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-d",
    });

    // Next from canonical page-c (index 2) -> page-d (index 3), the next
    // canonical page after page-c.
    nextHarness.control.next();
    nextHarness.advance(COALESCE_DELAY_MS);

    expect(nextHarness.writeControlState).toHaveBeenCalledTimes(1);
    expect(nextHarness.writeControlState).toHaveBeenLastCalledWith(3);
  });

  it("C: the derived actual index corresponds to page-c and never exposes the inconsistent reported index", () => {
    const h = createHarness();
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 0,
        pageId: "page-c",
        pageIndex: 1,
      }),
    );

    const view = h.views.at(-1);

    expect(view?.actualPageId).toBe("page-c");
    expect(view?.actualPageIndex).toBe(2);
    expect(view?.actualPageIndex).not.toBe(1);
    expect(view?.desiredPageId).toBe("page-c");
    expect(view?.desiredPageIndex).toBe(2);
  });

  it("D: an unknown actual pageId fails closed for navigation and follow", async () => {
    vi.useFakeTimers();

    const h = createHarness();
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 0,
        pageId: "unknown-page",
        pageIndex: 2,
      }),
    );

    const view = h.views.at(-1);

    expect(view?.actualPageId).toBe("unknown-page");
    expect(view?.actualPageIndex).toBeNull();
    expect(view?.desiredPageId).toBe("unknown-page");
    expect(view?.desiredPageIndex).toBeNull();

    h.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "unknown-page",
    });

    h.control.previous();
    h.control.next();
    h.control.followPlayer();
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).not.toHaveBeenCalled();
  });
});
