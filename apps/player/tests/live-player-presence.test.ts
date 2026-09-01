import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  disconnectSet: vi.fn(),
  onDisconnect: vi.fn(),
  ref: vi.fn(),
  serverTimestamp: vi.fn(() => ({ ".sv": "timestamp" })),
  set: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  onDisconnect: mocks.onDisconnect,
  ref: mocks.ref,
  serverTimestamp: mocks.serverTimestamp,
  set: mocks.set,
}));

import {
  PLAYER_PRESENCE_PATH,
  startPlayerPresence,
} from "../src/live-player-presence";

describe("Player presence reporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.disconnectSet.mockResolvedValue(undefined);
    mocks.cancel.mockResolvedValue(undefined);
    mocks.onDisconnect.mockReturnValue({
      set: mocks.disconnectSet,
      cancel: mocks.cancel,
    });
    mocks.set.mockResolvedValue(undefined);
  });

  it("registers the owned disconnect before publishing connected starting", async () => {
    await startPlayerPresence({} as never, 7, "version-1");

    expect(mocks.ref).toHaveBeenCalledWith({}, PLAYER_PRESENCE_PATH);
    expect(mocks.disconnectSet).toHaveBeenCalledWith({
      activationRevision: 7,
      currentVersionId: "version-1",
      bootId: expect.any(String),
      connected: false,
      stage: "starting",
      transitionedAt: { ".sv": "timestamp" },
    });
    expect(mocks.set).toHaveBeenCalledWith(
      { path: PLAYER_PRESENCE_PATH },
      {
        activationRevision: 7,
        currentVersionId: "version-1",
        bootId: expect.any(String),
        connected: true,
        stage: "starting",
        transitionedAt: { ".sv": "timestamp" },
      },
    );
    expect(mocks.disconnectSet.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.set.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it("preserves one boot owner for ready, load failure, and disconnect", async () => {
    const reporter = await startPlayerPresence({} as never, 7, "version-1");
    const starting = mocks.set.mock.calls[0]?.[1] as { bootId: string };
    const disconnect = mocks.disconnectSet.mock.calls[0]?.[0] as { bootId: string };

    reporter.ready();
    reporter.failed("presentation-load-failed");
    await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(3));

    expect(disconnect.bootId).toBe(starting.bootId);
    expect(mocks.set.mock.calls[1]?.[1]).toMatchObject({
      bootId: starting.bootId,
      connected: true,
      stage: "ready",
    });
    expect(mocks.set.mock.calls[2]?.[1]).toEqual({
      activationRevision: 7,
      currentVersionId: "version-1",
      bootId: starting.bootId,
      connected: true,
      stage: "load-failed",
      transitionedAt: { ".sv": "timestamp" },
      errorCode: "presentation-load-failed",
    });
  });

  it("handles rejected transitions through the narrow error callback", async () => {
    const onError = vi.fn();
    const reporter = await startPlayerPresence(
      {} as never,
      7,
      "version-1",
      onError,
    );
    const failure = new Error("permission denied");
    mocks.set.mockRejectedValueOnce(failure);

    reporter.ready();

    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith("ready", failure),
    );
  });

  it("cancels disconnect once and does not write after stop", async () => {
    const reporter = await startPlayerPresence({} as never, 7, "version-1");

    reporter.stop();
    reporter.stop();
    reporter.ready();
    reporter.failed("player-mount-failed");
    await Promise.resolve();

    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });
});
