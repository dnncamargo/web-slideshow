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
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: "google.com" },
  }).database();
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
  it("rejects the current Player expiration when the client clock is ahead", async () => {
    const player = anonymous("player-clock-ahead");
    const clientClockAheadMs = 5_000;
    const clientNow = Date.now() + clientClockAheadMs;

    await assertFails(
      player.ref("playerPairingCodes/123450").transaction(() => ({
        playerUid: "player-clock-ahead",
        expiresAt: clientNow + 60_000,
      })),
    );
  });

  it("accepts server-time-compatible expirations for reasonable client clock offsets", async () => {
    const clientClockOffsets = [5_000, -5_000];

    for (const [index, clientClockOffsetMs] of clientClockOffsets.entries()) {
      const playerUid = `player-clock-corrected-${index}`;
      const player = anonymous(playerUid);
      const pin = `12345${index + 1}`;
      const serverNow = Date.now();
      const clientNow = serverNow + clientClockOffsetMs;
      const serverTimeOffset = -clientClockOffsetMs;
      const expiresAt = clientNow + serverTimeOffset + 60_000 - 5_000;

      const result = await player.ref(`playerPairingCodes/${pin}`).transaction(() => ({
        playerUid,
        expiresAt,
      }));

      expect(result.committed).toBe(true);
    }
  });

  it("enforces expiration bounds, distinguishes collisions, and permits renewal", async () => {
    const player = anonymous("player-pairing-lifecycle");
    const otherPlayer = anonymous("player-pairing-collision");
    const lowerBoundPin = "123461";
    const upperBoundPin = "123462";
    const occupiedPin = "123463";
    const now = Date.now();

    await assertFails(player.ref(`playerPairingCodes/${lowerBoundPin}`).set({
      playerUid: "player-pairing-lifecycle",
      expiresAt: now - 1,
    }));
    await assertFails(player.ref(`playerPairingCodes/${upperBoundPin}`).set({
      playerUid: "player-pairing-lifecycle",
      expiresAt: now + 65_000,
    }));

    await assertSucceeds(player.ref(`playerPairingCodes/${occupiedPin}`).transaction(() => ({
      playerUid: "player-pairing-lifecycle",
      expiresAt: Date.now() + 55_000,
    })));

    const ordinaryCollision = await otherPlayer
      .ref(`playerPairingCodes/${occupiedPin}`)
      .transaction((current) => {
        if (current !== null) return;
        return {
          playerUid: "player-pairing-collision",
          expiresAt: Date.now() + 55_000,
        };
      });
    expect(ordinaryCollision.committed).toBe(false);

    await assertFails(
      otherPlayer.ref(`playerPairingCodes/${occupiedPin}`).transaction(() => ({
        playerUid: "player-pairing-collision",
        expiresAt: Date.now() + 55_000,
      })),
    );

    await assertSucceeds(player.ref(`playerPairingCodes/${occupiedPin}`).transaction(() => ({
      playerUid: "player-pairing-lifecycle",
      expiresAt: Date.now() + 55_000,
    })));
  });

  it("rejects unauthenticated and non-anonymous PIN reservations", async () => {
    const unauthenticated = testEnv.unauthenticatedContext().database();
    const accountClient = account("account-cannot-reserve");

    await assertFails(unauthenticated.ref("playerPairingCodes/123464").set({
      playerUid: "player-unauthenticated",
      expiresAt: Date.now() + 55_000,
    }));
    await assertFails(accountClient.ref("playerPairingCodes/123465").set({
      playerUid: "player-account",
      expiresAt: Date.now() + 55_000,
    }));
  });

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

  it("allows the authenticated owner to transact at the Live root without exposing that root cross-account or to a bound anonymous Player", async () => {
    const owner = account("account-root-transaction");
    const otherOwner = account("account-root-other");
    const player = anonymous("player-root-transaction");

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.database().ref("playerBindings/player-root-transaction").set({
        ownerUid: "account-root-transaction",
      });
    });

    const live = owner.ref("live/account-root-transaction");

    await assertSucceeds(
      live.transaction(() => ({
        activationRevision: 1,
        current: {
          publicationId: "publication-root",
          currentVersionId: "version-root",
          revision: 1,
        },
      })),
    );

    await assertSucceeds(live.once("value"));
    await assertFails(otherOwner.ref("live/account-root-transaction").once("value"));
    await assertFails(player.ref("live/account-root-transaction").once("value"));

    await assertSucceeds(
      player.ref("live/account-root-transaction/current").once("value"),
    );
  });

  it("lets an account query and remove only its own Player bindings", async () => {
    const ownerA = account("account-bindings-a");
    const ownerB = account("account-bindings-b");
    const playerA = anonymous("player-bindings-a");

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const database = context.database();
      await database.ref("playerBindings/player-bindings-a").set({
        ownerUid: "account-bindings-a",
      });
      await database.ref("playerBindings/player-bindings-b").set({
        ownerUid: "account-bindings-b",
      });
    });

    await assertSucceeds(
      ownerA
        .ref("playerBindings")
        .orderByChild("ownerUid")
        .equalTo("account-bindings-a")
        .once("value"),
    );
    await assertFails(ownerA.ref("playerBindings").once("value"));
    await assertFails(
      ownerA
        .ref("playerBindings")
        .orderByChild("ownerUid")
        .equalTo("account-bindings-b")
        .once("value"),
    );

    await assertFails(
      ownerB.ref("playerBindings/player-bindings-a").remove(),
    );
    await assertFails(
      playerA.ref("playerBindings/player-bindings-a").remove(),
    );
    await assertSucceeds(
      ownerA.ref("playerBindings/player-bindings-a").remove(),
    );
  });

  it("lets an unbound Player delete only its own tagged presence and prevents new runtime writes", async () => {
    const owner = account("account-presence-cleanup");
    const player = anonymous("player-presence-cleanup");
    const otherPlayer = anonymous("player-presence-other");

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const database = context.database();
      await database.ref("live/account-presence-cleanup/current").set({
        publicationId: "publication-presence",
        currentVersionId: "version-presence",
        revision: 1,
      });
      await database.ref("playerBindings/player-presence-cleanup").set({
        ownerUid: "account-presence-cleanup",
      });
    });

    const current = player.ref("live/account-presence-cleanup/playerPresence/current");
    const lease = player.ref("live/account-presence-cleanup/playerPresence/leases/boot-presence");

    await assertSucceeds(current.set({
      activationRevision: 1,
      currentVersionId: "version-presence",
      playerUid: "player-presence-cleanup",
      bootId: "boot-presence",
      stage: "ready",
      transitionedAt: Date.now(),
    }));
    await assertSucceeds(lease.set({
      activationRevision: 1,
      currentVersionId: "version-presence",
      playerUid: "player-presence-cleanup",
      bootId: "boot-presence",
      connected: true,
      transitionedAt: Date.now(),
    }));

    await assertSucceeds(
      owner.ref("playerBindings/player-presence-cleanup").remove(),
    );

    await assertFails(otherPlayer.ref("live/account-presence-cleanup/playerPresence/current").remove());
    await assertFails(otherPlayer.ref("live/account-presence-cleanup/playerPresence/leases/boot-presence").remove());
    await assertSucceeds(current.remove());
    await assertSucceeds(lease.remove());

    await assertFails(current.set({
      activationRevision: 1,
      currentVersionId: "version-presence",
      playerUid: "player-presence-cleanup",
      bootId: "boot-new",
      stage: "starting",
      transitionedAt: Date.now(),
    }));
  });

  it("rejects anonymous Control writes while preserving bounded Player runtime writes", async () => {
    const player = anonymous("player-runtime");
    const owner = account("account-runtime");

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.database().ref("live/account-runtime/current").set({
        publicationId: "publication-1",
        currentVersionId: "version-1",
        revision: 1,
      });
      await context.database().ref("playerBindings/player-runtime").set({
        ownerUid: "account-runtime",
      });
    });

    await assertFails(
      player.ref("live/account-runtime/controlState").set({
        activationRevision: 1,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "slide-1",
      }),
    );
    await assertSucceeds(
      owner.ref("live/account-runtime/controlState").set({
        activationRevision: 1,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "slide-1",
      }),
    );
    await assertSucceeds(
      player.ref("live/account-runtime/playerState").set({
        activationRevision: 1,
        currentVersionId: "version-1",
        appliedControlRevision: 0,
        pageId: "slide-1",
        pageIndex: 0,
      }),
    );
  });

  it("isolates private Live protocol state by account and Player binding", async () => {
    const ownerA = account("account-isolation-a");
    const ownerB = account("account-isolation-b");
    const playerA = anonymous("player-isolation-a");
    const playerB = anonymous("player-isolation-b");

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const database = context.database();
      await database.ref("playerBindings/player-isolation-a").set({ ownerUid: "account-isolation-a" });
      await database.ref("playerBindings/player-isolation-b").set({ ownerUid: "account-isolation-b" });
    });

    await assertSucceeds(ownerA.ref("live/account-isolation-a/current").set({
      publicationId: "publication-a",
      currentVersionId: "version-a",
      revision: 1,
    }));
    await assertSucceeds(ownerB.ref("live/account-isolation-b/current").set({
      publicationId: "publication-b",
      currentVersionId: "version-b",
      revision: 1,
    }));

    await assertSucceeds(ownerA.ref("live/account-isolation-a/controlState").set({
      activationRevision: 1,
      currentVersionId: "version-a",
      revision: 1,
      pageId: "slide-a",
    }));
    await assertSucceeds(ownerB.ref("live/account-isolation-b/controlState").set({
      activationRevision: 1,
      currentVersionId: "version-b",
      revision: 1,
      pageId: "slide-b",
    }));

    await assertSucceeds(playerA.ref("live/account-isolation-a/playerState").set({
      activationRevision: 1,
      currentVersionId: "version-a",
      appliedControlRevision: 1,
      pageId: "slide-a",
      pageIndex: 0,
    }));
    await assertSucceeds(playerB.ref("live/account-isolation-b/playerState").set({
      activationRevision: 1,
      currentVersionId: "version-b",
      appliedControlRevision: 1,
      pageId: "slide-b",
      pageIndex: 0,
    }));

    await assertFails(playerA.ref("live/account-isolation-b/playerState").set({
      activationRevision: 1,
      currentVersionId: "version-b",
      appliedControlRevision: 1,
      pageId: "slide-b",
      pageIndex: 0,
    }));
    await assertFails(playerB.ref("live/account-isolation-a/controlState").once("value"));
    await assertFails(ownerA.ref("live/account-isolation-b/controlState").set({
      activationRevision: 1,
      currentVersionId: "version-b",
      revision: 2,
      pageId: "slide-b-2",
    }));
    await assertFails(ownerB.ref("live/account-isolation-a/playerPresence").once("value"));
  });

  it("keeps activation revisions, promotion, and end account-local", async () => {
    const ownerA = account("account-lifecycle-a");
    const ownerB = account("account-lifecycle-b");
    const liveA = ownerA.ref("live/account-lifecycle-a");
    const liveB = ownerB.ref("live/account-lifecycle-b");

    await assertSucceeds(liveA.child("activationRevision").set(1));
    await assertSucceeds(liveB.child("activationRevision").set(1));
    await assertSucceeds(liveA.child("current").set({
      publicationId: "publication-a",
      currentVersionId: "version-a",
      revision: 1,
    }));
    await assertSucceeds(liveB.child("current").set({
      publicationId: "publication-b",
      currentVersionId: "version-b",
      revision: 1,
    }));

    await assertSucceeds(liveA.child("current").set({
      publicationId: "publication-a",
      currentVersionId: "version-a-2",
      revision: 1,
    }));

    const bAfterPromotion = await liveB.child("current").once("value");
    expect(bAfterPromotion.val()).toEqual({
      publicationId: "publication-b",
      currentVersionId: "version-b",
      revision: 1,
    });
    expect((await liveA.child("activationRevision").once("value")).val()).toBe(1);
    expect((await liveB.child("activationRevision").once("value")).val()).toBe(1);

    await assertSucceeds(liveA.update({ current: null }));
    expect((await liveA.child("current").once("value")).exists()).toBe(false);
    expect((await liveB.child("current").once("value")).val()).toEqual({
      publicationId: "publication-b",
      currentVersionId: "version-b",
      revision: 1,
    });
  });
});
