import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string; isAnonymous: boolean } | null },
  initializeAuth: vi.fn(),
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
  getPlayerFirebaseApp: vi.fn(() => ({})),
  get: vi.fn(),
  onValue: vi.fn(),
  bindingCallback: null as ((snapshot: { val(): unknown }) => void) | null,
  ref: vi.fn((_database: unknown, path: string) => ({ path })),
  runTransaction: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: { kind: "browser-local" },
  getAuth: mocks.getAuth,
  initializeAuth: mocks.initializeAuth,
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInAnonymously: mocks.signInAnonymously,
}));

vi.mock("firebase/database", () => ({
  get: mocks.get,
  onValue: mocks.onValue,
  ref: mocks.ref,
  runTransaction: mocks.runTransaction,
}));

vi.mock("../src/realtime-db", () => ({
  getPlayerFirebaseApp: mocks.getPlayerFirebaseApp,
}));

import {
  formatPairingPin,
  normalizePairingPin,
  startPlayerPairing,
} from "../src/player-pairing";

describe("Player pairing identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.currentUser = null;
    mocks.initializeAuth.mockReturnValue(mocks.auth);
    mocks.getAuth.mockReturnValue(mocks.auth);
    mocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(mocks.auth.currentUser);
      return vi.fn();
    });
    mocks.signInAnonymously.mockImplementation(async () => {
      const user = { uid: "player-anonymous", isAnonymous: true };
      mocks.auth.currentUser = user;
      return { user };
    });
    mocks.get.mockResolvedValue({ val: () => null });
    mocks.bindingCallback = null;
    mocks.onValue.mockImplementation((_ref, callback) => {
      mocks.bindingCallback = callback;
      return vi.fn();
    });
    mocks.runTransaction.mockImplementation(async (_ref, update) => ({
      committed: true,
      snapshot: { val: () => update(null) },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes visual spacing without changing the canonical PIN", () => {
    expect(normalizePairingPin("123 456")).toBe("123456");
    expect(formatPairingPin("123456")).toBe("123 456");
    expect(normalizePairingPin("123-456")).toBeNull();
  });

  it("creates an anonymous identity once and explicitly requests local persistence", async () => {
    const states: unknown[] = [];
    const session = await startPlayerPairing({} as never, (state) => states.push(state));

    expect(mocks.initializeAuth).toHaveBeenCalledWith(
      {},
      { persistence: { kind: "browser-local" } },
    );
    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(session.playerUid).toBe("player-anonymous");
    expect(states).toContainEqual({ kind: "pairing", pin: expect.any(String) });

    session.destroy();
  });

  it("reuses the existing anonymous identity without creating another account", async () => {
    mocks.auth.currentUser = { uid: "player-existing", isAnonymous: true };
    const session = await startPlayerPairing({} as never, vi.fn());

    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    expect(session.playerUid).toBe("player-existing");

    session.destroy();
  });

  it("tries another PIN when the first active pairing slot is occupied", async () => {
    mocks.runTransaction
      .mockResolvedValueOnce({ committed: false, snapshot: { val: () => null } })
      .mockImplementationOnce(async (_ref, update) => ({
        committed: true,
        snapshot: { val: () => update(null) },
      }));

    const session = await startPlayerPairing({} as never, vi.fn());

    expect(mocks.runTransaction).toHaveBeenCalledTimes(2);
    session.destroy();
  });

  it("returns a paired Player to PIN mode when its durable binding is removed", async () => {
    mocks.auth.currentUser = { uid: "player-existing", isAnonymous: true };
    mocks.get.mockResolvedValueOnce({ val: () => ({ ownerUid: "account-1" }) });
    const states: unknown[] = [];
    const session = await startPlayerPairing(
      {} as never,
      (state) => states.push(state),
    );

    expect(session.state).toEqual({ kind: "paired", ownerUid: "account-1" });
    expect(mocks.bindingCallback).not.toBeNull();

    mocks.bindingCallback?.({ val: () => null });

    await vi.waitFor(() => {
      expect(states).toContainEqual({ kind: "pairing", pin: expect.any(String) });
    });
    expect(session.playerUid).toBe("player-existing");
    expect(mocks.runTransaction).toHaveBeenCalled();

    session.destroy();
  });
});
