import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onValue: vi.fn(), ref: vi.fn() }));
vi.mock("firebase/database", () => mocks);

import { buildPlayerLogsUrl, parsePlayerLogs, subscribePlayerLogs } from "../src/live-player-logs";

describe("live Player logs", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.ref.mockImplementation((_db: unknown, path: string) => ({ path })); });
  afterEach(() => vi.restoreAllMocks());

  it("strictly parses only exact records", () => {
    expect(parsePlayerLogs({ activationRevision: 7, enabled: true })).toEqual({ activationRevision: 7, enabled: true });
    expect(parsePlayerLogs({ activationRevision: 7, enabled: false })).toEqual({ activationRevision: 7, enabled: false });
    expect(parsePlayerLogs({ enabled: true })).toBeNull();
    expect(parsePlayerLogs({ activationRevision: 7, enabled: true, extra: true })).toBeNull();
    expect(parsePlayerLogs({ activationRevision: -1, enabled: true })).toBeNull();
    expect(parsePlayerLogs({ activationRevision: 7, enabled: "true" })).toBeNull();
  });

  it("builds local logs URLs without changing local routing", () => {
    expect(buildPlayerLogsUrl("https://player.example/", true)).toBe("https://player.example/?logs=true");
    expect(buildPlayerLogsUrl("https://player.example/?foo=bar", true)).toBe("https://player.example/?foo=bar&logs=true");
    expect(buildPlayerLogsUrl("https://player.example/?foo=bar&logs=false#x", true)).toBe("https://player.example/?foo=bar&logs=true#x");
    expect(buildPlayerLogsUrl("https://player.example/?logs=false&logs=no#x", true)).toBe("https://player.example/?logs=true#x");
    expect(buildPlayerLogsUrl("https://player.example/path?foo=bar&logs=true#x", false)).toBe("https://player.example/path#x");
  });

  it("navigates matching desired state once and cleans up", () => {
    let listener!: (snapshot: { val(): unknown }) => void;
    const unsubscribe = vi.fn();
    mocks.onValue.mockImplementation((_reference: unknown, callback: typeof listener) => { listener = callback; return unsubscribe; });
    const navigation = { replace: vi.fn() };
    const location = { href: "https://player.example/?foo=bar" };
    const cleanup = subscribePlayerLogs({} as never, 7, location, navigation);
    listener({ val: () => ({ activationRevision: 7, enabled: true }) });
    expect(navigation.replace).toHaveBeenCalledWith("https://player.example/?foo=bar&logs=true");
    listener({ val: () => ({ activationRevision: 7, enabled: false }) });
    expect(navigation.replace).toHaveBeenLastCalledWith("https://player.example/");
    navigation.replace.mockClear();
    listener({ val: () => null });
    listener({ val: () => ({ activationRevision: 8, enabled: true }) });
    listener({ val: () => ({ activationRevision: 7, enabled: true, extra: true }) });
    expect(navigation.replace).not.toHaveBeenCalled();
    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when URL already reflects desired state", () => {
    let listener!: (snapshot: { val(): unknown }) => void;
    mocks.onValue.mockImplementation((_reference: unknown, callback: typeof listener) => { listener = callback; return vi.fn(); });
    const navigation = { replace: vi.fn() };
    subscribePlayerLogs({} as never, 7, { href: "https://player.example/?logs=true" }, navigation);
    listener({ val: () => ({ activationRevision: 7, enabled: true }) });
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
