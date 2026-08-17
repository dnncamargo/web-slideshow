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
  const livePageIds = ["page-a", "page-b", "page-c"];
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
      confirmedPageId: "page-a",
      confirmedPageIndex: 0,
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
      confirmedPageId: "page-a",
      confirmedPageIndex: 0,
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
      confirmedPageId: "page-a",
      confirmedPageIndex: 0,
    });
    expect(second.views.at(-1)?.status).toEqual({ kind: "syncing" });
    expect(second.writeControlState).not.toHaveBeenCalled();
  });

  it("treats a new Player baseline as current truth even after a higher confirmed revision", () => {
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
      confirmedPageId: "page-a",
      confirmedPageIndex: 0,
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

  it("retains a trailing target until the current persisted desired revision is confirmed", async () => {
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

    const committed =
      deferred<Awaited<ReturnType<typeof h.writeControlState>>>();
    h.writeControlState.mockReturnValue(committed.promise);

    h.control.next();
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).not.toHaveBeenCalled();

    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-b",
        pageIndex: 1,
      }),
    );

    expect(h.writeControlState).not.toHaveBeenCalled();

    h.advance(COALESCE_DELAY_MS);
    committed.resolve({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-c",
    });

    await Promise.resolve();

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(2);
  });

  it("rechecks convergence before a scheduled trailing write", async () => {
    vi.useFakeTimers();

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

    const committed =
      deferred<Awaited<ReturnType<typeof h.writeControlState>>>();

    h.writeControlState.mockReturnValue(committed.promise);

    // B -> C schedules the trailing write.
    h.control.next();

    // Before the timer fires, a new Player runtime establishes A / rev 0.
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 0,
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    h.advance(COALESCE_DELAY_MS);

    // rev 8 is no longer confirmed, so rev 9 must not be written yet.
    expect(h.writeControlState).not.toHaveBeenCalled();

    // The new Player runtime reapplies the persisted desired rev 8 / B.
    h.control.handlePlayerState(
      playerState({
        appliedControlRevision: 8,
        pageId: "page-b",
        pageIndex: 1,
      }),
    );

    // Confirmation schedules the retained C target again.
    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(2);

    committed.resolve({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 9,
      pageId: "page-c",
    });

    await Promise.resolve();
  });

  it("coalesces user input and keeps a single unconfirmed write in flight", () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.control.handlePlayerState(playerState());

    h.writeControlState.mockImplementation(() => new Promise(() => undefined));

    h.control.next();
    h.control.next();
    h.control.next();

    h.advance(COALESCE_DELAY_MS);

    expect(h.writeControlState).toHaveBeenCalledTimes(1);
    expect(h.writeControlState).toHaveBeenLastCalledWith(2);
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
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
        ["page-a", "page-b", "page-c"][pageIndex] ?? null,
      resolvePageIndex: (pageId) =>
        ["page-a", "page-b", "page-c"].findIndex((id) => id === pageId),
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
      confirmedPageId: "page-a",
      confirmedPageIndex: 0,
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

  it("does not converge when the revision matches but the pageId is wrong", () => {
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
      confirmedPageId: "page-c",
      confirmedPageIndex: 2,
    });
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });
});
