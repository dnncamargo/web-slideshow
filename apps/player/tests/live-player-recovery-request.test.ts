// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onValue: vi.fn(), ref: vi.fn() }));
vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref }));

import { buildPlayerReloadUrl, parsePlayerRecoveryRequest, PLAYER_RECOVERY_REQUEST_PATH, subscribePlayerRecoveryRequest } from "../src/live-player-recovery-request";

const request = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "version-1", revision: 1, targetBootId: "boot-a", action: "reload", requestedAt: 42, ...overrides });
const snapshot = (value: unknown) => ({ val: () => value });

describe("Player recovery request", () => {
  beforeEach(() => { mocks.onValue.mockReset(); mocks.ref.mockReset(); mocks.ref.mockImplementation((_db: unknown, path: string) => ({ path })); mocks.onValue.mockReturnValue(vi.fn()); });

  it("builds a deterministic fresh URL while preserving path, query, logs and hash", () => {
    expect(buildPlayerReloadUrl("https://player.example/live?logs=true&x=1#slide", 7, 3)).toBe("https://player.example/live?logs=true&x=1&_psreload=7-3#slide");
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
    expect(navigation.replace).toHaveBeenCalledWith("https://player.example/live?logs=true&_psreload=7-1#x");
    cleanup();
    expect(mocks.onValue.mock.results[0]?.value).toHaveBeenCalledTimes(1);
  });

  it("makes a new boot ignore a persisted request addressed to the old boot", () => {
    const navigation = { replace: vi.fn() };
    subscribePlayerRecoveryRequest({} as never, 7, "version-1", "boot-b", { href: "https://player.example/live" }, navigation);
    const handler = mocks.onValue.mock.calls[0]?.[1] as (value: ReturnType<typeof snapshot>) => void;
    handler(snapshot(request()));
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
