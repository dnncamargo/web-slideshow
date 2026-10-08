import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  ref: vi.fn((_database: unknown, path: string) => ({ path })),
  remove: vi.fn(),
  runTransaction: vi.fn(),
  getCurrentNonAnonymousUser: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  get: mocks.get,
  ref: mocks.ref,
  remove: mocks.remove,
  runTransaction: mocks.runTransaction,
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: mocks.getCurrentNonAnonymousUser,
}));

import {
  claimPlayerByPin,
  normalizePairingPin,
} from "../src/features/control/player-pairing";

describe("Control Player pairing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "account-1" });
    mocks.get.mockResolvedValue({
      val: () => ({ playerUid: "player-1", expiresAt: Date.now() + 30_000 }),
    });
    mocks.runTransaction.mockImplementation(async (_ref, update) => ({
      committed: true,
      snapshot: { val: () => update(null) },
    }));
    mocks.remove.mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("normalizes the displayed PIN before lookup", async () => {
    expect(normalizePairingPin("123 456")).toBe("123456");

    await claimPlayerByPin({} as never, "123 456");

    expect(mocks.ref).toHaveBeenCalledWith({}, "playerPairingCodes/123456");
  });

  it("rejects an expired PIN without creating a binding", async () => {
    mocks.get.mockResolvedValue({
      val: () => ({ playerUid: "player-1", expiresAt: Date.now() - 1 }),
    });

    await expect(claimPlayerByPin({} as never, "123456")).rejects.toThrow(
      "invalid or expired",
    );
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("atomically claims the unowned Player and consumes the PIN", async () => {
    await expect(claimPlayerByPin({} as never, "123 456")).resolves.toEqual({
      playerUid: "player-1",
      ownerUid: "account-1",
    });

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith({ path: "playerPairingCodes/123456" });
  });

  it("rejects a second account when the binding transaction does not commit", async () => {
    mocks.runTransaction.mockResolvedValue({
      committed: false,
      snapshot: { val: () => ({ ownerUid: "account-1" }) },
    });

    await expect(claimPlayerByPin({} as never, "123456")).rejects.toThrow(
      "already paired",
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
