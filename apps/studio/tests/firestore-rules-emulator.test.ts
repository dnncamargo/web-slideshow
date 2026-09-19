import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc, writeBatch, Timestamp } from "firebase/firestore";

const projectId = "demo-web-slideshow-firestore-rules";
const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
let testEnv: RulesTestEnvironment;

function draft(uid: string, presentationId: string, archived = true, publication?: Record<string, unknown>) {
  return {
    presentationJson: JSON.stringify({ legacy: true, presentationId }),
    createdAt: Timestamp.fromMillis(1),
    updatedAt: Timestamp.fromMillis(1),
    draftRevision: 2,
    ...(archived ? { archivedAt: Timestamp.fromMillis(2) } : {}),
    ...(publication ? { publication } : {}),
  };
}

async function seedPublished(uid: string, presentationId: string, archived = true) {
  const publicationId = `publication-${presentationId}`;
  const currentVersionId = `version-current-${presentationId}`;
  const publishedAt = Timestamp.fromMillis(3);
  const publication = {
    publicationId,
    currentVersionId,
    publishedRevision: 2,
    publishedAt,
  };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, "users", uid, "presentations", presentationId), draft(uid, presentationId, archived, publication));
    await setDoc(doc(firestore, "publishedPresentations", publicationId), {
      currentVersionId,
      publishedRevision: 2,
      publishedAt,
    });
    await setDoc(doc(firestore, "publishedPresentations", publicationId, "versions", currentVersionId), {
      presentationId,
      presentationJson: JSON.stringify({ published: true }),
      publishedRevision: 2,
      publishedAt,
    });
  });
  return { publicationId, currentVersionId, publishedAt };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules } });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("Firestore deletion authorization", () => {
  it("allows the archived owner to list and delete historical versions, but not the current version", async () => {
    const ids = await seedPublished("owner", "presentation-list");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, "publishedPresentations", ids.publicationId, "versions", "version-history"), {
        presentationId: "presentation-list",
        presentationJson: JSON.stringify({ historical: true }),
        publishedRevision: 1,
        publishedAt: Timestamp.fromMillis(2),
      });
    });

    const owner = testEnv.authenticatedContext("owner").firestore();
    await assertSucceeds(getDocs(collection(owner, "publishedPresentations", ids.publicationId, "versions")));
    await assertSucceeds(
      writeBatch(owner).delete(doc(owner, "publishedPresentations", ids.publicationId, "versions", "version-history")).commit(),
    );
    await assertFails(
      writeBatch(owner).delete(doc(owner, "publishedPresentations", ids.publicationId, "versions", ids.currentVersionId)).commit(),
    );
  });

  it("rejects unauthenticated and unrelated access, and rejects non-archived owners", async () => {
    const ids = await seedPublished("owner-2", "presentation-denied");
    const unauthenticated = testEnv.unauthenticatedContext().firestore();
    const unrelated = testEnv.authenticatedContext("other").firestore();
    await assertFails(getDocs(collection(unauthenticated, "publishedPresentations", ids.publicationId, "versions")));
    await assertFails(getDocs(collection(unrelated, "publishedPresentations", ids.publicationId, "versions")));
    await assertFails(
      writeBatch(unrelated).delete(doc(unrelated, "publishedPresentations", ids.publicationId)).commit(),
    );

    await seedPublished("active-owner", "presentation-active", false);
    const active = testEnv.authenticatedContext("active-owner").firestore();
    await assertFails(getDocs(collection(active, "publishedPresentations", "publication-presentation-active", "versions")));
  });

  it("allows the owner to atomically delete published and unpublished archived lifecycles", async () => {
    const ids = await seedPublished("owner-3", "presentation-atomic");
    const owner = testEnv.authenticatedContext("owner-3").firestore();
    await assertSucceeds(
      writeBatch(owner)
        .delete(doc(owner, "publishedPresentations", ids.publicationId, "versions", ids.currentVersionId))
        .delete(doc(owner, "publishedPresentations", ids.publicationId))
        .delete(doc(owner, "users", "owner-3", "presentations", "presentation-atomic", "private", "notes"))
        .delete(doc(owner, "users", "owner-3", "presentations", "presentation-atomic"))
        .commit(),
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "owner-3", "presentations", "presentation-unpublished"), draft("owner-3", "presentation-unpublished"));
      await setDoc(doc(context.firestore(), "users", "owner-3", "presentations", "presentation-unpublished", "private", "notes"), { text: "notes" });
    });
    await assertSucceeds(
      writeBatch(owner)
        .delete(doc(owner, "users", "owner-3", "presentations", "presentation-unpublished", "private", "notes"))
        .delete(doc(owner, "users", "owner-3", "presentations", "presentation-unpublished"))
        .commit(),
    );
  });

  it("rejects standalone pointer, current-version, draft, notes-orphaning, and non-archived deletes", async () => {
    const ids = await seedPublished("owner-4", "presentation-atomic-denied");
    const owner = testEnv.authenticatedContext("owner-4").firestore();
    await assertFails(writeBatch(owner).delete(doc(owner, "publishedPresentations", ids.publicationId)).commit());
    await assertFails(writeBatch(owner).delete(doc(owner, "publishedPresentations", ids.publicationId, "versions", ids.currentVersionId)).commit());
    await assertFails(writeBatch(owner).delete(doc(owner, "users", "owner-4", "presentations", "presentation-atomic-denied")).commit());

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "owner-4", "presentations", "presentation-active-unpublished"), draft("owner-4", "presentation-active-unpublished", false));
    });
    await assertFails(writeBatch(owner).delete(doc(owner, "users", "owner-4", "presentations", "presentation-active-unpublished")).commit());

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "owner-4", "presentations", "presentation-notes-orphan"), draft("owner-4", "presentation-notes-orphan"));
      await setDoc(doc(context.firestore(), "users", "owner-4", "presentations", "presentation-notes-orphan", "private", "notes"), { text: "notes" });
    });
    await assertFails(writeBatch(owner).delete(doc(owner, "users", "owner-4", "presentations", "presentation-notes-orphan")).commit());
  });
});
