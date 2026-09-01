import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ ref: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(() => 99), user: { uid: "user-1" } as { uid: string } | null }));
vi.mock("firebase/database", () => ({ ref: mocks.ref, runTransaction: mocks.runTransaction, serverTimestamp: mocks.serverTimestamp }));
vi.mock("../src/features/auth/firebase-auth", () => ({ getCurrentNonAnonymousUser: () => mocks.user }));

import { PLAYER_RECOVERY_REQUEST_PATH, requestPlayerReload } from "../src/features/control/player-recovery-request";

describe("Player recovery writer", () => {
  it("starts at revision one and increments only within the same activation/version", async () => {
    mocks.ref.mockReturnValue({ path: PLAYER_RECOVERY_REQUEST_PATH });
    mocks.runTransaction.mockImplementation(async (_ref, update) => ({ committed: true, snapshot: { val: () => update({ activationRevision: 7, currentVersionId: "version-1", revision: 3, targetBootId: "old", action: "reload", requestedAt: 1 }) } }));
    await expect(requestPlayerReload({} as never, 7, "version-1", "boot-a")).resolves.toMatchObject({ revision: 4, targetBootId: "boot-a", action: "reload" });
    mocks.runTransaction.mockImplementation(async (_ref, update) => ({ committed: true, snapshot: { val: () => update({ activationRevision: 6, currentVersionId: "old", revision: 9, targetBootId: "old", action: "reload", requestedAt: 1 }) } }));
    await expect(requestPlayerReload({} as never, 7, "version-1", "boot-a")).resolves.toMatchObject({ revision: 1 });
  });
});
