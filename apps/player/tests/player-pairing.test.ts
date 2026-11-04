import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string; isAnonymous: boolean } | null },
  initializeAuth: vi.fn(),
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  signInAnonymously: vi.fn(),
  getPlayerFirebaseApp: vi.fn(() => ({})),
  recordPlayerDiagnostic: vi.fn(),
  get: vi.fn(),
  equalTo: vi.fn((_key: string, value: string) => value),
  orderByChild: vi.fn((key: string) => key),
  query: vi.fn((target: { path: string }) => ({ ...target, query: true })),
  remove: vi.fn(),
  onDisconnect: vi.fn(() => ({ cancel: vi.fn().mockResolvedValue(undefined) })),
  onValue: vi.fn(),
  bindingCallback: null as ((snapshot: { val(): unknown }) => void) | null,
  serverTimeOffset: 0 as unknown,
  offsetUnsubscribe: vi.fn(),
  ref: vi.fn((_database: unknown, path: string) => ({ path })),
  runTransaction: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: { kind: "browser-local" },
  getAuth: mocks.getAuth,
  initializeAuth: mocks.initializeAuth,
  onAuthStateChanged: mocks.onAuthStateChanged,
  signOut: mocks.signOut,
  signInAnonymously: mocks.signInAnonymously,
}));

vi.mock("firebase/database", () => ({
  get: mocks.get,
  equalTo: mocks.equalTo,
  onDisconnect: mocks.onDisconnect,
  orderByChild: mocks.orderByChild,
  onValue: mocks.onValue,
  query: mocks.query,
  ref: mocks.ref,
  remove: mocks.remove,
  runTransaction: mocks.runTransaction,
}));

vi.mock("../src/realtime-db", () => ({
  getPlayerFirebaseApp: mocks.getPlayerFirebaseApp,
}));

vi.mock("../src/player-diagnostics", () => ({
  recordPlayerDiagnostic: mocks.recordPlayerDiagnostic,
}));

import {
  formatPairingPin,
  normalizePairingPin,
  PLAYER_PAIRING_PIN_CLOCK_SAFETY_MARGIN_MS,
  PLAYER_PAIRING_PIN_TTL_MS,
  resetPlayerIdentity,
  startPlayerPairing,
} from "../src/player-pairing";

describe("Player pairing identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordPlayerDiagnostic.mockReset();
    mocks.auth.currentUser = null;
    mocks.signOut.mockImplementation(async () => { mocks.auth.currentUser = null; });
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
    mocks.remove.mockResolvedValue(undefined);
    mocks.bindingCallback = null;
    mocks.serverTimeOffset = 0;
    mocks.offsetUnsubscribe = vi.fn();
    mocks.onValue.mockImplementation((target: { path: string }, callback) => {
      if (target.path === ".info/serverTimeOffset") {
        callback({ val: () => mocks.serverTimeOffset });
        return mocks.offsetUnsubscribe;
      }

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
    vi.unstubAllGlobals();
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
    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_PAIRING_BINDING_READ_OK",
      expect.objectContaining({ operation: "bindingRead", durationMs: expect.any(Number) }),
    );
    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_PAIRING_PIN_TRANSACTION_OK",
      expect.objectContaining({
        operation: "pinReservationTransaction",
        committed: true,
        durationMs: expect.any(Number),
      }),
    );

    session.destroy();
  });

  it.each([
    { clientClockOffsetMs: 0, serverTimeOffsetMs: 0 },
    { clientClockOffsetMs: 5_000, serverTimeOffsetMs: -5_000 },
    { clientClockOffsetMs: -5_000, serverTimeOffsetMs: 5_000 },
  ])(
    "uses the RTDB server time offset for a $clientClockOffsetMs ms client skew",
    async ({ clientClockOffsetMs, serverTimeOffsetMs }) => {
      const serverNow = 1_700_000_000_000;
      const nowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValue(serverNow + clientClockOffsetMs);
      mocks.serverTimeOffset = serverTimeOffsetMs;

      try {
        const session = await startPlayerPairing({} as never, vi.fn());
        const update = mocks.runTransaction.mock.calls[0]?.[1] as (
          value: unknown,
        ) => { playerUid: string; expiresAt: number };
        const record = update(null);

        expect(record.expiresAt).toBe(
          serverNow + PLAYER_PAIRING_PIN_TTL_MS - PLAYER_PAIRING_PIN_CLOCK_SAFETY_MARGIN_MS,
        );
        expect(mocks.offsetUnsubscribe).toHaveBeenCalledOnce();
        session.destroy();
      } finally {
        nowSpy.mockRestore();
      }
    },
  );

  it.each([null, "0", Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects an invalid RTDB server time offset (%s) before reserving a PIN",
    async (offset) => {
      mocks.serverTimeOffset = offset;

      await expect(startPlayerPairing({} as never, vi.fn())).rejects.toThrow(
        "Realtime Database server time offset is unavailable.",
      );
      expect(mocks.runTransaction).not.toHaveBeenCalled();
      expect(mocks.offsetUnsubscribe).toHaveBeenCalledOnce();
      expect(JSON.stringify(mocks.recordPlayerDiagnostic.mock.calls)).not.toContain(
        "player-anonymous",
      );
    },
  );

  it("records a sanitized binding read failure without changing the rejection", async () => {
    const failure = Object.assign(
      new Error(
        "permission_denied at /playerBindings/player-secret?token=secret-token",
      ),
      { code: "PERMISSION_DENIED" },
    );
    mocks.get.mockRejectedValueOnce(failure);

    await expect(startPlayerPairing({} as never, vi.fn())).rejects.toBe(failure);

    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_PAIRING_BINDING_READ_START",
      expect.objectContaining({
        operation: "bindingRead",
        isAnonymous: true,
      }),
    );
    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_PAIRING_BINDING_READ_ERROR",
      expect.objectContaining({
        operation: "bindingRead",
        durationMs: expect.any(Number),
        isAnonymous: true,
        error: {
          name: "Error",
          code: "PERMISSION_DENIED",
          message: expect.not.stringContaining("player-secret"),
        },
      }),
    );

    const serializedDiagnostics = JSON.stringify(mocks.recordPlayerDiagnostic.mock.calls);
    expect(serializedDiagnostics).not.toContain("123456");
    expect(serializedDiagnostics).not.toContain("secret-token");
  });

  it("records a sanitized PIN transaction failure without changing the rejection", async () => {
    const failure = Object.assign(
      new Error("permission_denied at /playerPairingCodes/123456?token=secret-token"),
      { code: "PERMISSION_DENIED" },
    );
    mocks.runTransaction.mockRejectedValueOnce(failure);

    await expect(startPlayerPairing({} as never, vi.fn())).rejects.toBe(failure);

    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_PAIRING_PIN_TRANSACTION_START",
      expect.objectContaining({
        operation: "pinReservationTransaction",
        attempt: 1,
        isAnonymous: true,
      }),
    );
    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_PAIRING_PIN_TRANSACTION_ERROR",
      expect.objectContaining({
        operation: "pinReservationTransaction",
        attempt: 1,
        durationMs: expect.any(Number),
        isAnonymous: true,
        error: {
          name: "Error",
          code: "PERMISSION_DENIED",
          message: expect.not.stringContaining("123456"),
        },
      }),
    );

    const serializedDiagnostics = JSON.stringify(mocks.recordPlayerDiagnostic.mock.calls);
    expect(serializedDiagnostics).not.toContain("secret-token");
  });

  it("keeps pairing successful when the diagnostics sink throws", async () => {
    mocks.recordPlayerDiagnostic.mockImplementation(() => {
      throw new Error("diagnostics unavailable");
    });

    const session = await startPlayerPairing({} as never, vi.fn());

    expect(session.state.kind).toBe("pairing");
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
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

  it("removes only the old identity resources before signing in a different UID", async () => {
    mocks.auth.currentUser = { uid: "player-old", isAnonymous: true };
    let bindingReadCount = 0;
    mocks.get.mockImplementation(async (target: { path: string; query?: boolean }) => {
      if (target.path === "playerBindings/player-old") {
        bindingReadCount += 1;
        if (bindingReadCount > 1) return { val: () => null, exists: () => false };
        return { val: () => ({ ownerUid: "account-old" }), exists: () => true };
      }
      if (target.path === "live/account-old/playerPresence") {
        return { val: () => ({
          current: { playerUid: "player-old", bootId: "boot-old" },
          leases: { "boot-old": { playerUid: "player-old", bootId: "boot-old" } },
        }) };
      }
      if (target.path === "playerPairingCodes") {
        return { val: () => ({ "111111": { playerUid: "player-old", expiresAt: Date.now() + 10_000 } }) };
      }
      if (target.path === "playerPairingClaims/player-old") {
        return { val: () => ({ pin: "111111" }), exists: () => true };
      }
      return { val: () => null, exists: () => false };
    });
    mocks.runTransaction.mockImplementation(async (target: { path: string }, update) => ({
      committed: true,
      snapshot: (() => {
        const value = update(target.path === "playerBindings/player-old" ? { ownerUid: "account-old" } : null);
        return { val: () => value, exists: () => value !== null };
      })(),
    }));
    vi.stubGlobal("navigator", { locks: { request: async (_name: string, callback: () => Promise<void>) => callback() } });
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() });
    vi.stubGlobal("BroadcastChannel", undefined);

    await resetPlayerIdentity({} as never);

    expect(mocks.remove).toHaveBeenCalledWith({ path: "playerPairingCodes/111111" });
    expect(mocks.remove).toHaveBeenCalledWith({ path: "playerPairingClaims/player-old" });
    expect(mocks.runTransaction).toHaveBeenCalledWith(
      { path: "playerBindings/player-old" },
      expect.any(Function),
      { applyLocally: false },
    );
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.auth.currentUser?.uid).toBe("player-anonymous");
  });

  it("records a sanitized Firebase error when conditional binding removal is denied", async () => {
    mocks.auth.currentUser = { uid: "player-old", isAnonymous: true };
    mocks.get.mockImplementation(async (target: { path: string; query?: boolean }) => {
      if (target.path === "playerBindings/player-old") {
        return { val: () => ({ ownerUid: "account-old" }), exists: () => true };
      }
      if (target.path === "playerPairingClaims/player-old") {
        return { val: () => null, exists: () => false };
      }
      return { val: () => null, exists: () => false };
    });
    mocks.runTransaction.mockRejectedValueOnce({
      name: "FirebaseError",
      code: "PERMISSION_DENIED",
      message: "playerBindings/player-old denied for PIN 123456",
    });
    vi.stubGlobal("navigator", { locks: { request: async (_name: string, callback: () => Promise<void>) => callback() } });
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() });
    vi.stubGlobal("BroadcastChannel", undefined);

    await expect(resetPlayerIdentity({} as never)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });

    expect(mocks.recordPlayerDiagnostic).toHaveBeenCalledWith(
      "PLAYER_IDENTITY_RESET_STEP",
      expect.objectContaining({
        stage: "binding-transaction",
        result: "error",
        name: "FirebaseError",
        code: "PERMISSION_DENIED",
        message: "playerBindings/<redacted> denied for PIN <redacted>",
      }),
    );
  });

  it("does not reset authentication if another tab already changed the UID", async () => {
    mocks.auth.currentUser = { uid: "player-old", isAnonymous: true };
    vi.stubGlobal("navigator", { locks: { request: async (_name: string, callback: () => Promise<void>) => {
      mocks.auth.currentUser = { uid: "player-new", isAnonymous: true };
      return callback();
    } } });

    await resetPlayerIdentity({} as never);

    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
