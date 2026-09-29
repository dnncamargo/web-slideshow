import { readFileSync } from "node:fs";

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteObject,
  getBytes,
  ref,
  uploadBytes,
} from "firebase/storage";

const projectId = "demo-web-slideshow-storage-rules";
const rules = readFileSync(new URL("../../../storage.rules", import.meta.url), "utf8");
const assetPath = "users/owner/assets/asset-1";
const otherUserPath = "users/other/assets/asset-1";
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    storage: { rules },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("Firebase Storage ownership rules", () => {
  it("allows a non-anonymous owner to create, read, update, and delete own assets", async () => {
    const storage = testEnv.authenticatedContext("owner").storage();
    const asset = ref(storage, assetPath);

    await assertSucceeds(uploadBytes(asset, new Uint8Array([1, 2, 3])));
    await assertSucceeds(getBytes(asset));
    await assertSucceeds(uploadBytes(asset, new Uint8Array([4, 5])));
    await assertSucceeds(deleteObject(asset));
  });

  it("rejects another authenticated user from reading, overwriting, or deleting an asset", async () => {
    const ownerStorage = testEnv.authenticatedContext("owner").storage();
    const otherStorage = testEnv.authenticatedContext("other").storage();
    const ownerAsset = ref(ownerStorage, assetPath);
    const otherView = ref(otherStorage, assetPath);

    await assertSucceeds(uploadBytes(ownerAsset, new Uint8Array([1, 2, 3])));
    await assertFails(getBytes(otherView));
    await assertFails(uploadBytes(otherView, new Uint8Array([4, 5])));
    await assertFails(deleteObject(otherView));
  });

  it("rejects unauthenticated and anonymous users", async () => {
    const unauthenticatedStorage = testEnv.unauthenticatedContext().storage();
    const anonymousStorage = testEnv.authenticatedContext("anonymous", {
      firebase: { sign_in_provider: "anonymous" },
    }).storage();

    await assertFails(
      uploadBytes(ref(unauthenticatedStorage, assetPath), new Uint8Array([1])),
    );
    await assertFails(getBytes(ref(unauthenticatedStorage, assetPath)));
    await assertFails(
      uploadBytes(ref(anonymousStorage, assetPath), new Uint8Array([1])),
    );
    await assertFails(getBytes(ref(anonymousStorage, assetPath)));
  });

  it("rejects an owner from writing under another user's namespace", async () => {
    const ownerStorage = testEnv.authenticatedContext("owner").storage();

    await assertFails(
      uploadBytes(ref(ownerStorage, otherUserPath), new Uint8Array([1])),
    );
  });
});
