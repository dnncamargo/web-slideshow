import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LiveControl,
  COALESCE_DELAY_MS,
  type LiveControlView,
} from "../src/features/control/live-control";
import type { SlideAck } from "../src/features/control/control-commands";

interface Harness {
  control: LiveControl;
  views: LiveControlView[];
  writeCommand: ReturnType<typeof vi.fn>;
  onCommandError: ReturnType<typeof vi.fn>;
  runTimers: () => void;
  advanceTime: (ms: number) => void;
  ack: (overrides?: Partial<SlideAck>) => void;
}

function createHarness(activationRevision = 1): Harness {
  let currentTime = 0;
  const views: LiveControlView[] = [];
  const writeCommand = vi.fn();
  const onCommandError = vi.fn();

  const control = new LiveControl({
    activationRevision,
    writeCommand,
    now: () => currentTime,
    schedule: (callback, delay) => {
      const id = setTimeout(() => {
        callback();
      }, delay);
      return () => clearTimeout(id);
    },
    onViewChange: (view) => views.push(view),
    onCommandError,
  });

  const ack = (overrides: Partial<SlideAck> = {}) => {
    control.handleAck({
      activationRevision,
      revision: 1,
      slideIndex: 0,
      ...overrides,
    });
  };

  return {
    control,
    views,
    writeCommand,
    runTimers: () => {
      currentTime += COALESCE_DELAY_MS;
      vi.advanceTimersByTime(COALESCE_DELAY_MS);
    },
    advanceTime: (ms) => {
      currentTime += ms;
    },
    ack,
    onCommandError,
  };
}

describe("LiveControl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts disabled, awaiting player, and baseline ack enables navigation", () => {
    vi.useFakeTimers();
    const h = createHarness();

    expect(h.views.at(-1)).toMatchObject({ enabled: false });
    expect(h.views.at(-1)?.status).toEqual({ kind: "awaiting-player" });

    h.ack({ revision: 0, slideIndex: 2 });

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      confirmedIndex: 2,
    });
    expect(h.views.at(-1)?.status).toEqual({ kind: "synced" });
  });

  it("ignores an ack for a different activation revision", () => {
    vi.useFakeTimers();
    const h = createHarness(3);

    h.control.handleAck({ activationRevision: 2, revision: 0, slideIndex: 4 });

    expect(h.views.at(-1)?.enabled).toBe(false);
    expect(h.views.at(-1)?.status).toEqual({ kind: "awaiting-player" });
  });

  it("coalesces rapid desired targets into a single command", () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.ack({ revision: 0, slideIndex: 0 });

    h.control.next();
    h.control.next();
    h.control.next();

    h.runTimers();

    expect(h.writeCommand).toHaveBeenCalledTimes(1);
    expect(h.writeCommand).toHaveBeenCalledWith(3);
  });

  it("keeps at most one unacknowledged command in flight", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.ack({ revision: 0, slideIndex: 0 });
    h.writeCommand.mockImplementation(async () => ({
      activationRevision: 1,
      revision: 1,
      slideIndex: 1,
    }));

    h.control.next();
    h.runTimers();
    await h.writeCommand.mock.results[0]?.value;

    h.control.next();
    h.runTimers();

    expect(h.writeCommand).toHaveBeenCalledTimes(1);
  });

  it("retains clicks received while a command is pending", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.ack({ revision: 0, slideIndex: 0 });
    h.writeCommand.mockImplementation(async () => ({
      activationRevision: 1,
      revision: 1,
      slideIndex: 1,
    }));

    h.control.next();
    h.runTimers();
    await h.writeCommand.mock.results[0]?.value;

    h.control.next();
    h.control.next();

    h.ack({ revision: 1, slideIndex: 1 });

    h.runTimers();

    expect(h.writeCommand).toHaveBeenCalledTimes(2);
    expect(h.writeCommand).toHaveBeenLastCalledWith(3);
  });

  it("clears pending on a matching ack", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.ack({ revision: 0, slideIndex: 0 });
    h.writeCommand.mockImplementation(async () => ({
      activationRevision: 1,
      revision: 1,
      slideIndex: 2,
    }));

    h.control.next();
    h.control.next();
    h.runTimers();
    await h.writeCommand.mock.results[0]?.value;

    h.ack({ revision: 1, slideIndex: 2 });

    expect(h.views.at(-1)).toMatchObject({
      confirmedIndex: 2,
      enabled: true,
    });
    expect(h.views.at(-1)?.status).toEqual({
      kind: "synced",
      latencyMs: expect.any(Number),
    });

    h.control.next();
    h.runTimers();
    expect(h.writeCommand).toHaveBeenCalledTimes(2);
  });

  it("does not clear a newer pending command on a stale ack", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.ack({ revision: 0, slideIndex: 0 });
    h.writeCommand.mockImplementation(async (slideIndex) => ({
      activationRevision: 1,
      revision: h.writeCommand.mock.calls.length,
      slideIndex,
    }));

    h.control.next();
    h.runTimers();
    await h.writeCommand.mock.results[0]?.value;
    h.ack({ revision: 1, slideIndex: 1 });

    h.control.next();
    h.runTimers();
    await h.writeCommand.mock.results[1]?.value;

    const beforeStale = h.writeCommand.mock.calls.length;
    h.ack({ revision: 1, slideIndex: 1 });

    expect(h.writeCommand.mock.calls.length).toBe(beforeStale);
    expect(h.views.at(-1)?.status).toEqual({ kind: "syncing" });
  });

  it("resets desired to the player's actual index when the ack differs", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.ack({ revision: 0, slideIndex: 0 });
    h.writeCommand.mockImplementation(async () => ({
      activationRevision: 1,
      revision: 1,
      slideIndex: 5,
    }));

    h.control.next();
    h.runTimers();
    await h.writeCommand.mock.results[0]?.value;

    h.ack({ revision: 1, slideIndex: 3 });

    expect(h.views.at(-1)?.confirmedIndex).toBe(3);

    h.runTimers();
    expect(h.writeCommand).toHaveBeenCalledTimes(1);
  });

  it("calculates latency on the matching ack", async () => {
    vi.useFakeTimers();
    const h = createHarness();
    h.ack({ revision: 0, slideIndex: 0 });

    h.writeCommand.mockImplementation(async () => ({
      activationRevision: 1,
      revision: 1,
      slideIndex: 1,
    }));

    h.control.next();
    h.runTimers();
    await h.writeCommand.mock.results[0]?.value;

    h.advanceTime(45);
    h.ack({ revision: 1, slideIndex: 1 });

    expect(h.views.at(-1)?.status).toEqual({ kind: "synced", latencyMs: 45 });
  });
  it("initializes from an existing non-zero ACK", () => {
    vi.useFakeTimers();
    const h = createHarness();

    h.ack({
      revision: 5,
      slideIndex: 3,
    });

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      confirmedIndex: 3,
    });

    expect(h.views.at(-1)?.status).toEqual({
      kind: "synced",
    });
  });
  it("does not regress confirmed state from an older ACK", () => {
    vi.useFakeTimers();
    const h = createHarness();

    h.ack({
      revision: 5,
      slideIndex: 4,
    });

    h.ack({
      revision: 4,
      slideIndex: 1,
    });

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      confirmedIndex: 4,
    });
  });
  it("reconciles an ACK that arrives before writeCommand resolves", async () => {
    vi.useFakeTimers();
    const h = createHarness();

    h.ack({
      revision: 0,
      slideIndex: 0,
    });

    let resolveWrite:
      | ((command: {
          activationRevision: number;
          revision: number;
          slideIndex: number;
        }) => void)
      | undefined;

    h.writeCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );

    h.control.next();
    h.runTimers();

    expect(h.writeCommand).toHaveBeenCalledWith(1);
    expect(h.views.at(-1)?.status).toEqual({
      kind: "syncing",
    });

    // Player ACK arrives before the command transaction Promise resolves.
    h.ack({
      revision: 1,
      slideIndex: 1,
    });

    expect(h.views.at(-1)?.status).toEqual({
      kind: "syncing",
    });

    resolveWrite?.({
      activationRevision: 1,
      revision: 1,
      slideIndex: 1,
    });

    await Promise.resolve();

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      confirmedIndex: 1,
    });

    expect(h.views.at(-1)?.status).toEqual({
      kind: "synced",
      latencyMs: expect.any(Number),
    });
  });
  it("resets desired state and reports an error when writeCommand fails", async () => {
    vi.useFakeTimers();
    const h = createHarness();

    h.ack({
      revision: 0,
      slideIndex: 2,
    });

    h.writeCommand.mockRejectedValue(new Error("write failed"));

    h.control.next();
    h.runTimers();

    await Promise.resolve();
    await Promise.resolve();

    expect(h.onCommandError).toHaveBeenCalledOnce();

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      confirmedIndex: 2,
    });

    expect(h.views.at(-1)?.status).toEqual({
      kind: "synced",
    });

    // The failed target must not remain as desired state.
    h.control.next();
    h.runTimers();

    expect(h.writeCommand).toHaveBeenLastCalledWith(3);
  });
  it("does not let an older ACK replace the retained early ACK", async () => {
    vi.useFakeTimers();
    const h = createHarness();

    h.ack({
      revision: 5,
      slideIndex: 0,
    });

    let resolveWrite:
      | ((command: {
          activationRevision: number;
          revision: number;
          slideIndex: number;
        }) => void)
      | undefined;

    h.writeCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );

    h.control.next();
    h.runTimers();

    // Correct ACK arrives first.
    h.ack({
      revision: 6,
      slideIndex: 1,
    });

    // Then an older duplicate arrives before the writer resolves.
    h.ack({
      revision: 5,
      slideIndex: 0,
    });

    resolveWrite?.({
      activationRevision: 1,
      revision: 6,
      slideIndex: 1,
    });

    await Promise.resolve();

    expect(h.views.at(-1)).toMatchObject({
      enabled: true,
      confirmedIndex: 1,
    });

    expect(h.views.at(-1)?.status).toEqual({
      kind: "synced",
      latencyMs: expect.any(Number),
    });
  });
  it("does not publish state after destroy while writeCommand is in flight", async () => {
    vi.useFakeTimers();
    const h = createHarness();

    h.ack({ revision: 0, slideIndex: 0 });

    let resolveWrite:
      | ((command: {
          activationRevision: number;
          revision: number;
          slideIndex: number;
        }) => void)
      | undefined;

    h.writeCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );

    h.control.next();
    h.runTimers();

    const viewsBeforeDestroy = h.views.length;

    h.control.destroy();

    resolveWrite?.({
      activationRevision: 1,
      revision: 1,
      slideIndex: 1,
    });

    await Promise.resolve();

    expect(h.views).toHaveLength(viewsBeforeDestroy);
    expect(h.onCommandError).not.toHaveBeenCalled();
  });
});
