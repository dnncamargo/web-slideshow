import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const projectId = "demo-web-slideshow-database-rules";
const rules = readFileSync(new URL("../../../database.rules.json", import.meta.url), "utf8");
let testEnv: RulesTestEnvironment;

function anonymous(uid: string) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
  }).database();
}

function account(uid: string) {
  return testEnv.authenticatedContext(uid).database();
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    database: { rules },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("Realtime Database Player pairing rules", () => {
  it("requires a valid claim before creating exactly one durable binding", async () => {
    const player = anonymous("player-claim-1");
    const owner = account("account-claim-1");
    const otherOwner = account("account-claim-2");
    const code = player.ref("playerPairingCodes/123456");
    const claim = owner.ref("playerPairingClaims/player-claim-1");

    await assertSucceeds(code.set({
      playerUid: "player-claim-1",
      expiresAt: Date.now() + 30_000,
    }));
    await assertFails(
      owner.ref("playerBindings/player-claim-1").set({ ownerUid: "account-claim-1" }),
    );
    await assertFails(
      player.ref("playerBindings/player-claim-1").set({ ownerUid: "player-claim-1" }),
    );
    await assertFails(otherOwner.ref("playerPairingCodes/123456").remove());

    await assertSucceeds(claim.transaction(() => ({
      pin: "123456",
      ownerUid: "account-claim-1",
      expiresAt: Date.now() + 10_000,
    })));
    await assertFails(
      otherOwner.ref("playerPairingClaims/player-claim-1").transaction(() => ({
        pin: "123456",
        ownerUid: "account-claim-2",
        expiresAt: Date.now() + 10_000,
      })),
    );
    await assertSucceeds(
      owner.ref("playerBindings/player-claim-1").transaction((current) =>
        current ?? { ownerUid: "account-claim-1" },
      ),
    );
    await assertFails(
      otherOwner.ref("playerBindings/player-claim-1").transaction((current) =>
        current ?? { ownerUid: "account-claim-2" },
      ),
    );

    await assertSucceeds(owner.ref("playerPairingCodes/123456").remove());
    await assertSucceeds(claim.remove());
    const binding = await player.ref("playerBindings/player-claim-1").once("value");
    expect(binding.val()).toEqual({ ownerUid: "account-claim-1" });
  });

  it("rejects expired and mismatched PIN claims by server rules", async () => {
    const owner = account("account-claim-invalid");
    const expiredCode = "223456";
    const mismatchedCode = "223457";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const database = context.database();
      await database.ref(`playerPairingCodes/${expiredCode}`).set({
        playerUid: "player-expired",
        expiresAt: Date.now() - 1,
      });
      await database.ref(`playerPairingCodes/${mismatchedCode}`).set({
        playerUid: "player-other",
        expiresAt: Date.now() + 30_000,
      });
    });

    await assertFails(
      owner.ref("playerPairingClaims/player-expired").set({
        pin: expiredCode,
        ownerUid: "account-claim-invalid",
        expiresAt: Date.now() + 10_000,
      }),
    );
    await assertFails(
      owner.ref("playerPairingClaims/player-target").set({
        pin: mismatchedCode,
        ownerUid: "account-claim-invalid",
        expiresAt: Date.now() + 10_000,
      }),
    );
  });

  it("allows expired claims to be replaced but rejects binding after claim expiry", async () => {
    const player = anonymous("player-claim-replace");
    const firstOwner = account("account-claim-first");
    const secondOwner = account("account-claim-second");
    await assertSucceeds(player.ref("playerPairingCodes/323456").set({
      playerUid: "player-claim-replace",
      expiresAt: Date.now() + 30_000,
    }));

    await assertSucceeds(
      firstOwner.ref("playerPairingClaims/player-claim-replace").set({
        pin: "323456",
        ownerUid: "account-claim-first",
        expiresAt: Date.now() + 100,
      }),
    );
    await wait(250);
    await assertSucceeds(
      secondOwner.ref("playerPairingClaims/player-claim-replace").set({
        pin: "323456",
        ownerUid: "account-claim-second",
        expiresAt: Date.now() + 10_000,
      }),
    );

    const expiringPlayer = anonymous("player-claim-expiring-binding");
    await assertSucceeds(expiringPlayer.ref("playerPairingCodes/323457").set({
      playerUid: "player-claim-expiring-binding",
      expiresAt: Date.now() + 30_000,
    }));
    await assertSucceeds(
      secondOwner.ref("playerPairingClaims/player-claim-expiring-binding").set({
        pin: "323457",
        ownerUid: "account-claim-second",
        expiresAt: Date.now() + 100,
      }),
    );
    await wait(250);
    await assertFails(
      secondOwner.ref("playerBindings/player-claim-expiring-binding").set({
        ownerUid: "account-claim-second",
      }),
    );
  });

  it("rejects extra fields in pairing code, claim, and binding shapes", async () => {
    const player = anonymous("player-shape");
    const owner = account("account-shape");
    const invalidPins = ["abcdef", "12345a", "12345", "1234567"];

    for (const pin of invalidPins) {
      await assertFails(player.ref(`playerPairingCodes/${pin}`).set({
        playerUid: "player-shape",
        expiresAt: Date.now() + 30_000,
      }));
    }

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const database = context.database();
      for (const pin of invalidPins) {
        await database.ref(`playerPairingCodes/${pin}`).set({
          playerUid: "player-shape",
          expiresAt: Date.now() + 30_000,
        });
      }
    });

    await assertFails(player.ref("playerPairingCodes/423456").set({
      playerUid: "player-shape",
      expiresAt: Date.now() + 30_000,
      extra: true,
    }));
    await assertSucceeds(player.ref("playerPairingCodes/423456").set({
      playerUid: "player-shape",
      expiresAt: Date.now() + 30_000,
    }));
    await assertFails(owner.ref("playerPairingClaims/player-shape").set({
      pin: "423456",
      ownerUid: "account-shape",
      expiresAt: Date.now() + 10_000,
      extra: true,
    }));
    await assertSucceeds(owner.ref("playerPairingClaims/player-shape").set({
      pin: "423456",
      ownerUid: "account-shape",
      expiresAt: Date.now() + 10_000,
    }));
    for (const pin of invalidPins) {
      await assertFails(owner.ref("playerPairingClaims/player-shape").set({
        pin,
        ownerUid: "account-shape",
        expiresAt: Date.now() + 10_000,
      }));
    }
    await assertFails(owner.ref("playerBindings/player-shape").set({
      ownerUid: "account-shape",
      extra: true,
    }));
  });

  it("rejects anonymous Control writes while preserving bounded Player runtime writes", async () => {
    const player = anonymous("player-runtime");
    const owner = account("account-runtime");

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.database().ref("live/current").set({
        publicationId: "publication-1",
        currentVersionId: "version-1",
        revision: 1,
      });
    });

    await assertFails(
      player.ref("live/controlState").set({
        activationRevision: 1,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "slide-1",
      }),
    );
    await assertSucceeds(
      owner.ref("live/controlState").set({
        activationRevision: 1,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "slide-1",
      }),
    );
    await assertSucceeds(
      player.ref("live/playerState").set({
        activationRevision: 1,
        currentVersionId: "version-1",
        appliedControlRevision: 0,
        pageId: "slide-1",
        pageIndex: 0,
      }),
    );
  });
});
