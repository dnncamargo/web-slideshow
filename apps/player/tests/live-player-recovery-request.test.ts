// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onValue: vi.fn(), ref: vi.fn() }));
vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref }));
const diagnostics = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("../src/player-diagnostics", () => ({
  recordPlayerDiagnostic: diagnostics.record,
}));

import { buildPlayerCacheClearUrl, buildPlayerReloadUrl, parsePlayerRecoveryRequest, PLAYER_CACHE_CLEAR_ROUTE, PLAYER_RECOVERY_REQUEST_PATH, subscribePlayerRecoveryRequest } from "../src/live-player-recovery-request";

const request = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "version-1", revision: 1, targetBootId: "boot-a", action: "reload", requestedAt: 42, ...overrides });
const snapshot = (value: unknown) => ({ val: () => value });

describe("Player recovery request", () => {
  beforeEach(() => {
    mocks.onValue.mockReset();
    mocks.ref.mockReset();
    diagnostics.record.mockReset();
    mocks.ref.mockImplementation((_db: unknown, path: string) => ({ path }));
    mocks.onValue.mockReturnValue(vi.fn());
  });

  it("builds a deterministic fresh URL while preserving path, query, logs and hash", () => {
    expect(buildPlayerReloadUrl("https://player.example/live?logs=true&x=1#slide", 7, 3)).toBe("https://player.example/live?logs=true&x=1&_psreload=7-3#slide");
  });

  it("builds the technical cache route with a fresh return URL", () => {
    expect(buildPlayerCacheClearUrl("https://player.example/live?logs=true&_psreload=old#slide", 7, 3)).toBe(
      `https://player.example${PLAYER_CACHE_CLEAR_ROUTE}?return=%2Flive%3Flogs%3Dtrue%26_psreload%3D7-3%23slide`,
    );
  });

  it.each([null, { ...request(), action: "other" }, { ...request(), extra: true }, { ...request(), requestedAt: "now" }])("rejects malformed requests", (value) => expect(parsePlayerRecoveryRequest(value)).toBeNull());

  it("replaces only for a valid exact-target new revision", () => {
    const navigation = { replace: vi.fn() };
    const cleanup = subscribePlayerRecoveryRequest({} as never, 7, "version-1", "boot-a", { href: "https://player.example/live?logs=true#x" }, navigation);
    const handler = mocks.onValue.mock.calls[0]?.[1] as (value: ReturnType<typeof snapshot>) => void;
    expect(mocks.ref).toHaveBeenCalledWith({}, PLAYER_RECOVERY_REQUEST_PATH);
    handler(snapshot({ ...request(), targetBootId: "boot-b" }));
    handler(snapshot({ ...request(), activationRevision: 6 }));
    handler(snapshot({ ...request(), currentVersionId: "old" }));
    handler(snapshot(request()));
    handler(snapshot(request()));
    handler(snapshot(request({ revision: 0 })));
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(diagnostics.record).toHaveBeenCalledWith("PLAYER_RECOVERY_RELOAD", {
      activationRevision: 7,
      revision: 1,
    });
    expect(navigation.replace).toHaveBeenCalledWith("https://player.example/live?logs=true&_psreload=7-1#x");
    cleanup();
    expect(mocks.onValue.mock.results[0]?.value).toHaveBeenCalledTimes(1);
  });

  it("dispatches retry without navigation and ignores duplicate revisions", async () => {
    const navigation = { replace: vi.fn() };
    const retry = vi.fn();
    subscribePlayerRecoveryRequest(
      {} as never,
      7,
      "version-1",
      "boot-a",
      { href: "https://player.example/live" },
      navigation,
      retry,
    );
    const handler = mocks.onValue.mock.calls[0]?.[1] as (value: ReturnType<typeof snapshot>) => void;
    handler(snapshot(request({ action: "retry" })));
    handler(snapshot(request({ action: "retry" })));
    await Promise.resolve();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(diagnostics.record).toHaveBeenCalledWith("PLAYER_RECOVERY_RETRY", {
      activationRevision: 7,
      revision: 1,
    });
  });

  it("accepts clear-cache once for an exact target and records before navigation", () => {
    const navigation = { replace: vi.fn() };
    subscribePlayerRecoveryRequest({} as never, 7, "version-1", "boot-a", { href: "https://player.example/live?logs=true#slide" }, navigation);
    const handler = mocks.onValue.mock.calls[0]?.[1] as (value: ReturnType<typeof snapshot>) => void;
    handler(snapshot(request({ action: "clear-cache" })));
    handler(snapshot(request({ action: "clear-cache" })));
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(diagnostics.record).toHaveBeenCalledWith("PLAYER_RECOVERY_CLEAR_CACHE", { activationRevision: 7, revision: 1 });
    expect(navigation.replace).toHaveBeenCalledWith(
      `https://player.example${PLAYER_CACHE_CLEAR_ROUTE}?return=%2Flive%3Flogs%3Dtrue%26_psreload%3D7-1%23slide`,
    );
  });

  it("records a sanitized subscription failure without navigating", () => {
    const navigation = { replace: vi.fn() };
    subscribePlayerRecoveryRequest(
      {} as never,
      7,
      "version-1",
      "boot-a",
      { href: "https://player.example/live" },
      navigation,
    );
    const errorHandler = mocks.onValue.mock.calls[0]?.[2] as (error: unknown) => void;
    errorHandler(new Error("permission denied"));
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(diagnostics.record).toHaveBeenCalledWith(
      "PLAYER_RECOVERY_SUBSCRIBE_ERROR",
      { error: expect.any(Error) },
    );
  });

  it("makes a new boot ignore a persisted request addressed to the old boot", () => {
    const navigation = { replace: vi.fn() };
    subscribePlayerRecoveryRequest({} as never, 7, "version-1", "boot-b", { href: "https://player.example/live" }, navigation);
    const handler = mocks.onValue.mock.calls[0]?.[1] as (value: ReturnType<typeof snapshot>) => void;
    handler(snapshot(request()));
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
