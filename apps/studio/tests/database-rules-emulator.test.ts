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
  it("allows temporary anonymous PIN ownership but only one non-anonymous binding", async () => {
    const player = anonymous("player-1");
    const owner = account("account-1");
    const otherOwner = account("account-2");

    await assertSucceeds(
      player.ref("playerPairingCodes/123456").set({
        playerUid: "player-1",
        expiresAt: Date.now() + 30_000,
      }),
    );
    await assertFails(
      player.ref("playerBindings/player-1").set({ ownerUid: "player-1" }),
    );

    await assertSucceeds(
      owner.ref("playerBindings/player-1").transaction((current) =>
        current ?? { ownerUid: "account-1" },
      ),
    );
    await assertSucceeds(owner.ref("playerPairingCodes/123456").remove());
    await assertFails(
      otherOwner.ref("playerBindings/player-1").transaction((current) =>
        current ?? { ownerUid: "account-2" },
      ),
    );

    const binding = await player.ref("playerBindings/player-1").once("value");
    expect(binding.val()).toEqual({ ownerUid: "account-1" });
    const code = await owner.ref("playerPairingCodes/123456").once("value");
    expect(code.exists()).toBe(false);
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
