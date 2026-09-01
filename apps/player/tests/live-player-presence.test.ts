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
  PLAYER_PRESENCE_CURRENT_PATH,
  PLAYER_PRESENCE_PATH,
  startPlayerPresence,
} from "../src/live-player-presence";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Player presence reporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.disconnectSet.mockResolvedValue(undefined);
    mocks.cancel.mockResolvedValue(undefined);
    mocks.onDisconnect.mockReturnValue({ set: mocks.disconnectSet, cancel: mocks.cancel });
    mocks.set.mockResolvedValue(undefined);
  });

  it("registers disconnect, publishes the connected lease, then publishes current", async () => {
    const registration = deferred();
    const leasePublication = deferred();
    mocks.disconnectSet.mockReturnValueOnce(registration.promise);
    mocks.set.mockReturnValueOnce(leasePublication.promise).mockResolvedValueOnce(undefined);

    const starting = startPlayerPresence({} as never, 7, "version-1");

    expect(mocks.disconnectSet).toHaveBeenCalledTimes(1);
    expect(mocks.set).not.toHaveBeenCalled();

    registration.resolve();
    await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(1));
    expect((mocks.set.mock.calls[0]?.[0] as { path: string }).path).toMatch(
      /^live\/playerPresence\/leases\/[a-z0-9-]+$/,
    );

    leasePublication.resolve();
    await starting;
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set.mock.calls[1]?.[0]).toEqual({ path: PLAYER_PRESENCE_CURRENT_PATH });

    const disconnect = mocks.disconnectSet.mock.calls[0]?.[0] as { bootId: string };
    const lease = mocks.set.mock.calls[0]?.[1] as { bootId: string };
    const current = mocks.set.mock.calls[1]?.[1] as { bootId: string };
    const leasePath = (mocks.set.mock.calls[0]?.[0] as { path: string }).path;

    expect(leasePath).toBe(`${PLAYER_PRESENCE_PATH}/leases/${lease.bootId}`);
    expect(disconnect).toEqual({
      activationRevision: 7,
      currentVersionId: "version-1",
      bootId: lease.bootId,
      connected: false,
      transitionedAt: { ".sv": "timestamp" },
    });
    expect(lease).toEqual({
      activationRevision: 7,
      currentVersionId: "version-1",
      bootId: disconnect.bootId,
      connected: true,
      transitionedAt: { ".sv": "timestamp" },
    });
    expect(current).toEqual({
      activationRevision: 7,
      currentVersionId: "version-1",
      bootId: lease.bootId,
      stage: "starting",
      transitionedAt: { ".sv": "timestamp" },
    });
  });

  it("updates only current for ready and allowlisted failure", async () => {
    const reporter = await startPlayerPresence({} as never, 7, "version-1");
    const initial = mocks.set.mock.calls[1]?.[1] as { bootId: string };

    reporter.ready();
    reporter.failed("presentation-load-failed");
    await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(4));

    expect(mocks.set.mock.calls[2]?.[0]).toEqual({ path: PLAYER_PRESENCE_CURRENT_PATH });
    expect(mocks.set.mock.calls[2]?.[1]).toMatchObject({ bootId: initial.bootId, stage: "ready" });
    expect(mocks.set.mock.calls[3]?.[0]).toEqual({ path: PLAYER_PRESENCE_CURRENT_PATH });
    expect(mocks.set.mock.calls[3]?.[1]).toEqual({
      activationRevision: 7,
      currentVersionId: "version-1",
      bootId: initial.bootId,
      stage: "load-failed",
      transitionedAt: { ".sv": "timestamp" },
      errorCode: "presentation-load-failed",
    });
  });

  it("does not publish lease or current when disconnect registration fails", async () => {
    const failure = new Error("registration denied");
    mocks.disconnectSet.mockRejectedValueOnce(failure);

    await expect(startPlayerPresence({} as never, 7, "version-1")).rejects.toBe(failure);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("does not publish current when connected lease publication fails", async () => {
    const failure = new Error("lease denied");
    mocks.set.mockRejectedValueOnce(failure);

    await expect(startPlayerPresence({} as never, 7, "version-1")).rejects.toBe(failure);
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });

  it("does not return a reporter when current starting publication fails", async () => {
    const failure = new Error("current denied");
    mocks.set.mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure);

    await expect(startPlayerPresence({} as never, 7, "version-1")).rejects.toBe(failure);
    expect(mocks.set).toHaveBeenCalledTimes(2);
  });

  it("sanitizes rejected ready and failed transitions", async () => {
    const onError = vi.fn();
    const reporter = await startPlayerPresence({} as never, 7, "version-1", onError);
    const readyFailure = new Error("ready denied");
    const failedFailure = new Error("failure denied");
    mocks.set.mockRejectedValueOnce(readyFailure).mockRejectedValueOnce(failedFailure);

    reporter.ready();
    reporter.failed("player-mount-failed");

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
    expect(onError).toHaveBeenNthCalledWith(1, "ready", readyFailure);
    expect(onError).toHaveBeenNthCalledWith(2, "load-failed", failedFailure);
  });

  it("stops transitions without canceling pagehide disconnect detection", async () => {
    const reporter = await startPlayerPresence({} as never, 7, "version-1");

    reporter.stop();
    reporter.stop();
    reporter.ready();
    reporter.failed("player-mount-failed");
    await Promise.resolve();

    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.disconnectSet).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledTimes(2);
  });
});
