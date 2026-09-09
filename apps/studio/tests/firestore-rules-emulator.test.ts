import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Firestore Emulator runtime coverage for the repository-root firestore.rules.
//
// This suite executes the REAL rules source against the Firestore Emulator
// through `firebase emulators:exec` (see the root
// `test:firestore-rules:emulator` script). It complements the static rules
// test in `firestore-rules.test.ts`; it does not replace it.
//
// The demo project ID is mandatory: it guarantees the harness can never
// accidentally contact a real Firebase project, and it keeps the emulator
// data namespace isolated. No Firebase credentials are used anywhere.
// ---------------------------------------------------------------------------

const PROJECT_ID = "demo-powershow-firestore-rules";
const RULES_SOURCE = readFileSync(
  new URL("../../../firestore.rules", import.meta.url),
  "utf8",
);

const ALICE_UID = "alice-rules-test";
const BOB_UID = "bob-rules-test";
const PRESENTATION_A = "presentation-a";
const PRESENTATION_B = "presentation-b";
const PUBLICATION_ID = "publication-1";
const OTHER_PUBLICATION_ID = "publication-other";
const CURRENT_VERSION_ID = "version-current";
const HISTORICAL_VERSION_ID = "version-historical";
const REVISION_CURRENT = 3;
const REVISION_HISTORICAL = 2;

// Fixed, deterministic timestamps so assertions never depend on wall-clock
// time. Only the "is timestamp" rules constraint is relevant to fixtures.
const BASE_SECONDS = 1_700_000_000;
const CREATED_AT = at(0);
const UPDATED_AT = at(1);
const ARCHIVED_AT = at(2);
const PUBLISHED_AT_HISTORICAL = at(3);
const PUBLISHED_AT_CURRENT = at(4);

function at(offsetSeconds: number): Timestamp {
  return new Timestamp(BASE_SECONDS + offsetSeconds, 0);
}

// presentationJson is an opaque string to the Rules; it only needs to be a
// non-empty JSON-serializable payload and stays internally consistent between
// the draft and its published versions.
function presentationJson(presentationId: string): string {
  return JSON.stringify({ schemaVersion: 1, presentationId, slide: [] });
}

interface PublicationMetadata {
  publicationId: string;
  currentVersionId: string;
  publishedRevision: number;
  publishedAt: Timestamp;
}

function publicationMetadata(
  overrides: Partial<PublicationMetadata> = {},
): PublicationMetadata {
  return {
    publicationId: PUBLICATION_ID,
    currentVersionId: CURRENT_VERSION_ID,
    publishedRevision: REVISION_CURRENT,
    publishedAt: PUBLISHED_AT_CURRENT,
    ...overrides,
  };
}

interface PointerFields {
  currentVersionId: string;
  publishedRevision: number;
  publishedAt: Timestamp;
}

function pointerFields(): PointerFields {
  return {
    currentVersionId: CURRENT_VERSION_ID,
    publishedRevision: REVISION_CURRENT,
    publishedAt: PUBLISHED_AT_CURRENT,
  };
}

interface VersionFields {
  presentationId: string;
  presentationJson: string;
  publishedRevision: number;
  publishedAt: Timestamp;
}

function versionFields(
  presentationId: string,
  revision: number,
  publishedAt: Timestamp,
): VersionFields {
  return {
    presentationId,
    presentationJson: presentationJson(presentationId),
    publishedRevision: revision,
    publishedAt,
  };
}

function draftRef(
  db: ReturnType<RulesTestContext["firestore"]>,
  uid: string,
  presentationId: string,
) {
  return doc(db, "users", uid, "presentations", presentationId);
}

function pointerRef(
  db: ReturnType<RulesTestContext["firestore"]>,
  publicationId: string,
) {
  return doc(db, "publishedPresentations", publicationId);
}

function versionRef(
  db: ReturnType<RulesTestContext["firestore"]>,
  publicationId: string,
  versionId: string,
) {
  return doc(
    db,
    "publishedPresentations",
    publicationId,
    "versions",
    versionId,
  );
}

function versionsCollection(
  db: ReturnType<RulesTestContext["firestore"]>,
  publicationId: string,
) {
  return collection(
    db,
    "publishedPresentations",
    publicationId,
    "versions",
  );
}

// Seeds the full persisted DPP lifecycle used by most cases:
//
//   publishedPresentations/{publicationId}                    (pointer)
//   publishedPresentations/{publicationId}/versions/{current} (current version)
//   publishedPresentations/{publicationId}/versions/{history} (historical)
//   users/{alice}/presentations/{presentation-a}              (private draft)
//
// Alice's draft is archived and carries publication metadata only when the
// corresponding options are set, so tests can isolate a single denied
// condition while keeping the rest of the chain internally consistent.
async function seedPublishedChain(
  ctx: RulesTestContext,
  options: {
    archiveDraft?: boolean;
    attachPublication?: boolean;
    publication?: Record<string, unknown>;
    historicalPresentationId?: string;
  } = {},
): Promise<void> {
  const db = ctx.firestore();
  const draft: Record<string, unknown> = {
    presentationJson: presentationJson(PRESENTATION_A),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    draftRevision: REVISION_CURRENT,
  };

  if (options.archiveDraft === true) {
    draft["archivedAt"] = ARCHIVED_AT;
  }
  if (options.attachPublication === true) {
    const publication = options.publication ?? publicationMetadata();
    // Spread into a fresh object literal so the value carries an implicit
    // index signature and stays compatible with the Record<string, unknown>
    // draft envelope.
    draft["publication"] = { ...publication };
  }

  await Promise.all([
    setDoc(pointerRef(db, PUBLICATION_ID), pointerFields()),
    setDoc(
      versionRef(db, PUBLICATION_ID, CURRENT_VERSION_ID),
      versionFields(PRESENTATION_A, REVISION_CURRENT, PUBLISHED_AT_CURRENT),
    ),
    setDoc(
      versionRef(db, PUBLICATION_ID, HISTORICAL_VERSION_ID),
      versionFields(
        options.historicalPresentationId ?? PRESENTATION_A,
        REVISION_HISTORICAL,
        PUBLISHED_AT_HISTORICAL,
      ),
    ),
    setDoc(draftRef(db, ALICE_UID, PRESENTATION_A), draft),
  ]);
}

// Seeds an archived never-published private draft for a user. Used only by
// the private draft deletion cases.
async function seedArchivedNeverPublishedDraft(
  ctx: RulesTestContext,
  uid: string,
  presentationId: string,
): Promise<void> {
  await setDoc(draftRef(ctx.firestore(), uid, presentationId), {
    presentationJson: presentationJson(presentationId),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    draftRevision: 1,
    archivedAt: ARCHIVED_AT,
  });
}

let testEnv: RulesTestEnvironment;
let alice: RulesTestContext;
let bob: RulesTestContext;
let unauthed: RulesTestContext;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES_SOURCE,
      host: "127.0.0.1",
      port: 8080,
    },
  });
  alice = testEnv.authenticatedContext(ALICE_UID);
  bob = testEnv.authenticatedContext(BOB_UID);
  unauthed = testEnv.unauthenticatedContext();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  // Guard against a failed suite initialization: Vitest still runs afterAll
  // hooks when beforeAll rejected, and testEnv would still be undefined.
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe("public reads", () => {
  it("1. unauthenticated exact get of a public pointer succeeds", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx);
    });

    const pointer = await assertSucceeds(
      getDoc(pointerRef(unauthed.firestore(), PUBLICATION_ID)),
    );
    expect(pointer.exists()).toBe(true);
  });

  it("2. unauthenticated exact get of a known public version succeeds", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx);
    });

    const version = await assertSucceeds(
      getDoc(versionRef(unauthed.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID)),
    );
    expect(version.exists()).toBe(true);
  });
});

describe("version list authorization", () => {
  it("3. unauthenticated list is denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx);
    });

    await assertFails(
      getDocs(
        query(versionsCollection(unauthed.firestore(), PUBLICATION_ID), limit(60)),
      ),
    );
  });

  it("4. unrelated authenticated user list is denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx);
    });

    await assertFails(
      getDocs(
        query(versionsCollection(bob.firestore(), PUBLICATION_ID), limit(60)),
      ),
    );
  });

  it("5. owner list is denied while the private draft is active", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // Draft is NOT archived: ownership contract requires an archived draft.
      await seedPublishedChain(ctx);
    });

    await assertFails(
      getDocs(
        query(versionsCollection(alice.firestore(), PUBLICATION_ID), limit(60)),
      ),
    );
  });

  it("6. owner list is denied when publicationId metadata does not match the path", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
        publication: {
          ...publicationMetadata({ publicationId: OTHER_PUBLICATION_ID }),
        },
      });
    });

    await assertFails(
      getDocs(
        query(versionsCollection(alice.firestore(), PUBLICATION_ID), limit(60)),
      ),
    );
  });

  it("7. owner list is denied when the query has no explicit limit", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    await assertFails(
      getDocs(versionsCollection(alice.firestore(), PUBLICATION_ID)),
    );
  });

  it("8. owner list is denied when the limit exceeds 100", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    await assertFails(
      getDocs(
        query(versionsCollection(alice.firestore(), PUBLICATION_ID), limit(101)),
      ),
    );
  });

  it("9. archived matching owner list with a positive limit at most 100 succeeds", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    const snapshot = await assertSucceeds(
      getDocs(
        query(versionsCollection(alice.firestore(), PUBLICATION_ID), limit(60)),
      ),
    );
    expect(snapshot.size).toBe(2);
  });

  it("10. the successful list does not require a presentationId where clause", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    // No `where` and no `orderBy`: the direct subcollection query with a limit
    // must return both the current and the historical version.
    const snapshot = await assertSucceeds(
      getDocs(
        query(versionsCollection(alice.firestore(), PUBLICATION_ID), limit(60)),
      ),
    );
    const ids = snapshot.docs.map((document) => document.id);
    expect(ids).toContain(CURRENT_VERSION_ID);
    expect(ids).toContain(HISTORICAL_VERSION_ID);
  });
});

describe("historical version deletion", () => {
  it("11. unauthenticated historical-version delete is denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx);
    });

    await assertFails(
      deleteDoc(
        versionRef(unauthed.firestore(), PUBLICATION_ID, HISTORICAL_VERSION_ID),
      ),
    );
  });

  it("12. unrelated authenticated user delete is denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx);
    });

    await assertFails(
      deleteDoc(
        versionRef(bob.firestore(), PUBLICATION_ID, HISTORICAL_VERSION_ID),
      ),
    );
  });

  it("13. owner delete is denied while the draft is active", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx);
    });

    await assertFails(
      deleteDoc(
        versionRef(alice.firestore(), PUBLICATION_ID, HISTORICAL_VERSION_ID),
      ),
    );
  });

  it("14. archived matching owner may delete a historical version", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    await assertSucceeds(
      deleteDoc(
        versionRef(alice.firestore(), PUBLICATION_ID, HISTORICAL_VERSION_ID),
      ),
    );
  });

  it("15. archived owner cannot delete a historical version whose presentationId does not match the pointer current version lifecycle", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // The target historical version references a DIFFERENT presentation.
      // Alice is its archived owner with valid publication metadata, so the
      // only failing condition is the pointer-current-version presentationId
      // mismatch.
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
        historicalPresentationId: PRESENTATION_B,
      });
      await setDoc(draftRef(ctx.firestore(), ALICE_UID, PRESENTATION_B), {
        presentationJson: presentationJson(PRESENTATION_B),
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        draftRevision: REVISION_HISTORICAL,
        archivedAt: ARCHIVED_AT,
        publication: publicationMetadata(),
      });
    });

    await assertFails(
      deleteDoc(
        versionRef(alice.firestore(), PUBLICATION_ID, HISTORICAL_VERSION_ID),
      ),
    );
  });

  it("16. update of an existing published version remains denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    await assertFails(
      updateDoc(
        versionRef(alice.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID),
        { presentationJson: presentationJson(PRESENTATION_A) },
      ),
    );
  });
});

describe("pointer/current version coupling", () => {
  it("17. archived owner cannot delete the current version by itself", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    await assertFails(
      deleteDoc(
        versionRef(alice.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID),
      ),
    );
  });

  it("18. archived owner cannot delete the pointer by itself", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    await assertFails(
      deleteDoc(pointerRef(alice.firestore(), PUBLICATION_ID)),
    );
  });

  it("19. unrelated authenticated user cannot delete either", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    await assertFails(
      deleteDoc(
        versionRef(bob.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID),
      ),
    );
    await assertFails(
      deleteDoc(pointerRef(bob.firestore(), PUBLICATION_ID)),
    );
  });

  it("20. archived matching owner can atomically delete the pointer and current version in one writeBatch", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    const batch = writeBatch(alice.firestore());
    batch.delete(
      versionRef(alice.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID),
    );
    batch.delete(pointerRef(alice.firestore(), PUBLICATION_ID));
    await assertSucceeds(batch.commit());
  });

  it("21. after the successful batch, exact public get of the deleted pointer fails", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    const batch = writeBatch(alice.firestore());
    batch.delete(
      versionRef(alice.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID),
    );
    batch.delete(pointerRef(alice.firestore(), PUBLICATION_ID));
    await assertSucceeds(batch.commit());

    const pointer = await assertSucceeds(
      getDoc(pointerRef(unauthed.firestore(), PUBLICATION_ID)),
    );
    expect(pointer.exists()).toBe(false);
  });

  it("22. after the successful batch, exact public get of the deleted current version fails", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    const batch = writeBatch(alice.firestore());
    batch.delete(
      versionRef(alice.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID),
    );
    batch.delete(pointerRef(alice.firestore(), PUBLICATION_ID));
    await assertSucceeds(batch.commit());

    const version = await assertSucceeds(
      getDoc(
        versionRef(unauthed.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID),
      ),
    );
    expect(version.exists()).toBe(false);
  });
});

describe("private draft deletion", () => {
  it("23. owner cannot delete an active never-published draft", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(draftRef(ctx.firestore(), ALICE_UID, PRESENTATION_A), {
        presentationJson: presentationJson(PRESENTATION_A),
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        draftRevision: 1,
      });
    });

    await assertFails(
      deleteDoc(draftRef(alice.firestore(), ALICE_UID, PRESENTATION_A)),
    );
  });

  it("24. unrelated user cannot delete another user's archived draft", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedArchivedNeverPublishedDraft(ctx, ALICE_UID, PRESENTATION_A);
    });

    await assertFails(
      deleteDoc(draftRef(bob.firestore(), ALICE_UID, PRESENTATION_A)),
    );
  });

  it("25. owner can delete an archived never-published draft", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedArchivedNeverPublishedDraft(ctx, ALICE_UID, PRESENTATION_A);
    });

    await assertSucceeds(
      deleteDoc(draftRef(alice.firestore(), ALICE_UID, PRESENTATION_A)),
    );
  });

  it("26. owner cannot delete an archived published draft while its public pointer exists", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    await assertFails(
      deleteDoc(draftRef(alice.firestore(), ALICE_UID, PRESENTATION_A)),
    );
  });

  it("27. owner can delete that archived published draft after the public pointer and current version have been atomically removed", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
      });
    });

    const batch = writeBatch(alice.firestore());
    batch.delete(
      versionRef(alice.firestore(), PUBLICATION_ID, CURRENT_VERSION_ID),
    );
    batch.delete(pointerRef(alice.firestore(), PUBLICATION_ID));
    await assertSucceeds(batch.commit());

    await assertSucceeds(
      deleteDoc(draftRef(alice.firestore(), ALICE_UID, PRESENTATION_A)),
    );
  });

  it("28. malformed publication metadata cannot bypass the published branch", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // The real pointer and current version exist, but the draft publication
      // metadata is malformed (missing publicationId). The authorized client
      // must still be denied: malformed metadata may not route the delete to
      // the never-published branch or point at a different path.
      await seedPublishedChain(ctx, {
        archiveDraft: true,
        attachPublication: true,
        publication: {
          currentVersionId: CURRENT_VERSION_ID,
          publishedRevision: REVISION_CURRENT,
          publishedAt: PUBLISHED_AT_CURRENT,
        },
      });
    });

    await assertFails(
      deleteDoc(draftRef(alice.firestore(), ALICE_UID, PRESENTATION_A)),
    );
  });
});