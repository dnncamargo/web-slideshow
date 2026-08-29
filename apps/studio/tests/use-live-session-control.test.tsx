// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  onValue: vi.fn(),
  promoteLivePresentationVersion: vi.fn(),
  ref: vi.fn(),
  subscribeLiveCurrent: vi.fn(),
  writeControlState: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  onValue: mocks.onValue,
  ref: mocks.ref,
}));

vi.mock("../src/features/control/realtime-db", () => ({
  getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull,
}));

vi.mock("../src/features/control/control-command-writer", () => ({
  writeControlState: mocks.writeControlState,
}));

vi.mock("../src/features/control/live-current", () => ({
  promoteLivePresentationVersion: mocks.promoteLivePresentationVersion,
  subscribeLiveCurrent: mocks.subscribeLiveCurrent,
}));

import type { UseLiveSessionControlResult } from "../src/features/control/use-live-session-control";
import { useLiveSessionControl } from "../src/features/control/use-live-session-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function snapshot(val: unknown) {
  return { val: () => val };
}

function handlerFor(path: string) {
  const call = [...mocks.onValue.mock.calls]
    .reverse()
    .find((entry) => entry[0]?.path === path);

  if (!call) {
    throw new Error(`missing handler for ${path}`);
  }

  return call[1] as (snapshot: { val: () => unknown }) => void;
}

const LIVE_PAGE_IDS = ["page-a", "page-b", "page-c"];

function resolvePageId(pageIndex: number): string | null {
  return LIVE_PAGE_IDS[pageIndex] ?? null;
}

function resolvePageIndex(pageId: string): number | null {
  const index = LIVE_PAGE_IDS.findIndex((id) => id === pageId);

  return index >= 0 ? index : null;
}

describe("useLiveSessionControl hydration", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: UseLiveSessionControlResult | null;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    result = null;

    mocks.getRealtimeDatabaseOrNull.mockReturnValue({});
    mocks.ref.mockImplementation((_db: unknown, path: string) => ({ path }));
    mocks.onValue.mockImplementation(() => vi.fn());
    mocks.writeControlState.mockResolvedValue({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-b",
    });
    mocks.promoteLivePresentationVersion.mockResolvedValue(undefined);
    mocks.subscribeLiveCurrent.mockImplementation((next) => {
      next({
        kind: "active",
        live: {
          publicationId: "publication-1",
          currentVersionId: "version-1",
          revision: 1,
        },
      });
      return vi.fn();
    });

    function Harness() {
      result = useLiveSessionControl({
        resolvePageId,
        resolvePageIndex,
      });

      return null;
    }

    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    await act(async () => {
      root.render(<Harness />);
    });

    await act(async () => {
      await Promise.resolve();
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });

    document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("waits for both initial snapshots before exposing an enabled view when playerState arrives first", async () => {
    const controlHandler = handlerFor("live/controlState");
    const playerHandler = handlerFor("live/playerState");

    await act(async () => {
      playerHandler(
        snapshot({
          activationRevision: 1,
          currentVersionId: "version-1",
          appliedControlRevision: 0,
          pageId: "page-a",
          pageIndex: 0,
        }),
      );
    });

    expect(result?.view).toBeNull();
    expect(mocks.writeControlState).not.toHaveBeenCalled();

    await act(async () => {
      controlHandler(
        snapshot({
          activationRevision: 1,
          currentVersionId: "version-1",
          revision: 8,
          pageId: "page-b",
        }),
      );
    });

    expect(result?.view).toMatchObject({
      enabled: true,
      desiredPageId: "page-b",
      desiredPageIndex: 1,
      actualPageId: "page-a",
      actualPageIndex: 0,
      status: { kind: "syncing" },
    });
    expect(mocks.writeControlState).not.toHaveBeenCalled();
  });

  it("waits for both initial snapshots before exposing an enabled view when controlState arrives first", async () => {
    const controlHandler = handlerFor("live/controlState");
    const playerHandler = handlerFor("live/playerState");

    await act(async () => {
      controlHandler(
        snapshot({
          activationRevision: 1,
          currentVersionId: "version-1",
          revision: 8,
          pageId: "page-b",
        }),
      );
    });

    expect(result?.view).toBeNull();

    await act(async () => {
      playerHandler(
        snapshot({
          activationRevision: 1,
          currentVersionId: "version-1",
          appliedControlRevision: 0,
          pageId: "page-a",
          pageIndex: 0,
        }),
      );
    });

    expect(result?.view).toMatchObject({
      enabled: true,
      desiredPageId: "page-b",
      desiredPageIndex: 1,
      actualPageId: "page-a",
      actualPageIndex: 0,
      status: { kind: "syncing" },
    });
    expect(mocks.writeControlState).not.toHaveBeenCalled();
  });

  it("treats absent initial snapshots as part of hydration before exposing the fallback awaiting view", async () => {
    const controlHandler = handlerFor("live/controlState");
    const playerHandler = handlerFor("live/playerState");

    await act(async () => {
      controlHandler(snapshot(null));
    });

    expect(result?.view).toBeNull();

    await act(async () => {
      playerHandler(snapshot(null));
    });

    expect(result?.view).toMatchObject({
      enabled: false,
      desiredPageId: null,
      desiredPageIndex: null,
      actualPageId: null,
      actualPageIndex: null,
      status: { kind: "awaiting-player" },
    });
    expect(mocks.writeControlState).not.toHaveBeenCalled();
  });

  it("exposes goTo through the existing live control writer", async () => {
    vi.useFakeTimers();
    const controlHandler = handlerFor("live/controlState");
    const playerHandler = handlerFor("live/playerState");

    await act(async () => {
      controlHandler(snapshot(null));
      playerHandler(
        snapshot({
          activationRevision: 1,
          currentVersionId: "version-1",
          appliedControlRevision: 0,
          pageId: "page-a",
          pageIndex: 0,
        }),
      );
    });

    await act(async () => {
      result?.goTo(2);
      vi.advanceTimersByTime(75);
      await Promise.resolve();
    });

    expect(mocks.writeControlState).toHaveBeenCalledWith(
      {},
      1,
      "version-1",
      "page-c",
    );
  });
});
