import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ref: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 99),
  user: { uid: "user-1" } as { uid: string } | null,
}));

vi.mock("firebase/database", () => ({
  ref: mocks.ref,
  runTransaction: mocks.runTransaction,
  serverTimestamp: mocks.serverTimestamp,
}));
vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: () => mocks.user,
}));

import {
  PLAYER_RECOVERY_REQUEST_PATH,
  requestPlayerReload,
  requestPlayerRetry,
} from "../src/features/control/player-recovery-request";

const existingRequest = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 7,
  currentVersionId: "version-1",
  revision: 3,
  targetBootId: "boot-old",
  action: "reload",
  requestedAt: 1,
  ...overrides,
});

describe("Player recovery writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { uid: "user-1" };
    mocks.ref.mockReturnValue({ path: PLAYER_RECOVERY_REQUEST_PATH });
  });

  function resolveTransaction(
    current: unknown,
    options: { committed?: boolean; result?: unknown } = {},
  ): void {
    mocks.runTransaction.mockImplementation(
      async (
        _reference: unknown,
        update: (value: unknown) => unknown,
      ) => {
        const proposed = update(current);
        return {
          committed: options.committed ?? true,
          snapshot: { val: () => options.result ?? proposed },
        };
      },
    );
  }

  it("rejects an unauthenticated user before starting a transaction", async () => {
    mocks.user = null;

    await expect(
      requestPlayerReload({} as never, 7, "version-1", "boot-a"),
    ).rejects.toThrow("authenticated user");

    expect(mocks.ref).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid activation %s before Firebase",
    async (activationRevision) => {
      await expect(
        requestPlayerReload(
          {} as never,
          activationRevision,
          "version-1",
          "boot-a",
        ),
      ).rejects.toThrow("active matching Player");

      expect(mocks.ref).not.toHaveBeenCalled();
      expect(mocks.runTransaction).not.toHaveBeenCalled();
      expect(mocks.serverTimestamp).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["   ", "boot-a", "version"],
    ["version-1", "   ", "boot"],
  ])("rejects blank %s or %s before Firebase", async (version, boot) => {
    await expect(
      requestPlayerReload({} as never, 7, version, boot),
    ).rejects.toThrow("active matching Player");

    expect(mocks.ref).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("uses revision 1 for the first valid request", async () => {
    resolveTransaction(null);

    await expect(
      requestPlayerReload({} as never, 7, "version-1", "boot-a"),
    ).resolves.toMatchObject({ revision: 1, targetBootId: "boot-a" });
  });

  it("increments exactly for the same activation and version", async () => {
    resolveTransaction(existingRequest());

    await expect(
      requestPlayerReload({} as never, 7, "version-1", "boot-a"),
    ).resolves.toMatchObject({ revision: 4 });
  });

  it.each([
    existingRequest({ activationRevision: 6 }),
    existingRequest({ currentVersionId: "version-old" }),
  ])("restarts at revision 1 for a different identity", async (current) => {
    resolveTransaction(current);

    await expect(
      requestPlayerReload({} as never, 7, "version-1", "boot-a"),
    ).resolves.toMatchObject({ revision: 1 });
  });

  it("rejects an uncommitted transaction", async () => {
    resolveTransaction(null, { committed: false });

    await expect(
      requestPlayerReload({} as never, 7, "version-1", "boot-a"),
    ).rejects.toThrow("Could not request Player reload");
  });

  it("rejects a malformed result snapshot", async () => {
    resolveTransaction(null, {
      result: { ...existingRequest({ revision: 1 }), extra: true },
    });

    await expect(
      requestPlayerReload({} as never, 7, "version-1", "boot-a"),
    ).rejects.toThrow("Could not request Player reload");
  });

  it("writes the exact path and uses serverTimestamp for requestedAt", async () => {
    let proposed: unknown;
    mocks.runTransaction.mockImplementation(
      async (_reference: unknown, update: (value: unknown) => unknown) => {
        proposed = update(null);
        return {
          committed: true,
          snapshot: { val: () => proposed },
        };
      },
    );

    await requestPlayerReload({} as never, 7, " version-1 ", " boot-a ");

    expect(mocks.ref).toHaveBeenCalledWith({}, PLAYER_RECOVERY_REQUEST_PATH);
    expect(mocks.runTransaction).toHaveBeenCalledWith(
      { path: PLAYER_RECOVERY_REQUEST_PATH },
      expect.any(Function),
    );
    expect(mocks.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(proposed).toEqual({
      activationRevision: 7,
      currentVersionId: "version-1",
      revision: 1,
      targetBootId: "boot-a",
      action: "reload",
      requestedAt: 99,
    });
  });

  it("writes retry with the same exact request shape and next revision", async () => {
    let proposed: unknown;
    mocks.runTransaction.mockImplementation(
      async (_reference: unknown, update: (value: unknown) => unknown) => {
        proposed = update(existingRequest());
        return { committed: true, snapshot: { val: () => proposed } };
      },
    );

    await expect(
      requestPlayerRetry({} as never, 7, "version-1", "boot-a"),
    ).resolves.toMatchObject({ action: "retry", revision: 4, targetBootId: "boot-a" });
    expect(proposed).toEqual({
      activationRevision: 7,
      currentVersionId: "version-1",
      revision: 4,
      targetBootId: "boot-a",
      action: "retry",
      requestedAt: 99,
    });
  });
});
