import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string; isAnonymous: boolean } | null },
  initializeAuth: vi.fn(),
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
  getPlayerFirebaseApp: vi.fn(() => ({})),
  recordPlayerDiagnostic: vi.fn(),
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

vi.mock("../src/player-diagnostics", () => ({
  recordPlayerDiagnostic: mocks.recordPlayerDiagnostic,
}));

import {
  formatPairingPin,
  normalizePairingPin,
  startPlayerPairing,
} from "../src/player-pairing";

describe("Player pairing identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordPlayerDiagnostic.mockReset();
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
});
