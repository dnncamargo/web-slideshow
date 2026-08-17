import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COALESCE_DELAY_MS,
  LiveControl,
  type LiveControlView,
} from "../src/features/control/live-control";

function controlState(overrides: Partial<{
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
}> = {}) {
  return {
    activationRevision: 1,
    currentVersionId: "version-1",
    revision: 1,
    pageId: "page-a",
    ...overrides,
  };
}

function playerState(overrides: Partial<{
  activationRevision: number;
  currentVersionId: string;
  appliedControlRevision: number;
  pageId: string;
  pageIndex: number;
}> = {}) {
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
      playerState({ appliedControlRevision: 7, pageId: "page-a", pageIndex: 0 }),
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
      playerState({ appliedControlRevision: 7, pageId: "page-a", pageIndex: 0 }),
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

  it("does not emit a replacement write when reloading with desired ahead of actual", () => {
    const h = createHarness();

    h.control.handlePlayerState(playerState());
    h.control.handleControlState(controlState({ revision: 8, pageId: "page-b" }));

    expect(h.writeControlState).not.toHaveBeenCalled();
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
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

  it("does not converge when the revision matches but the pageId is wrong", () => {
    const h = createHarness();
    h.control.handlePlayerState(playerState());
    h.control.handleControlState(controlState({ revision: 3, pageId: "page-b" }));

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
