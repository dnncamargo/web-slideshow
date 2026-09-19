import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { BackfillError, backfillPublicationOwner, parseArgs } from "./backfill-publication-owner.mjs";

const projectId = "demo-web-slideshow-publication-owner";
const ownerUid = "owner-a";
const presentationId = "presentation-a";
const publicationId = "publication-a";
const currentVersionId = "version-a";
const publishedAt = Timestamp.fromMillis(1_700_000_000_000);
const db = getFirestore(getApps().find((app) => app.options.projectId === projectId) ?? initializeApp({ projectId }));

function refs(suffix = "") {
  const id = `${suffix ? `${suffix}-` : ""}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    ownerUid: `${ownerUid}-${id}`,
    presentationId: `${presentationId}-${id}`,
    publicationId: `${publicationId}-${id}`,
    currentVersionId: `${currentVersionId}-${id}`,
  };
}

async function seed(input, overrides = {}) {
  const publication = {
    publicationId: input.publicationId,
    currentVersionId: input.currentVersionId,
    publishedRevision: 4,
    publishedAt,
    ...(overrides.publication ?? {}),
  };
  const draft = {
    presentationJson: "deliberately legacy and non-canonical",
    createdAt: publishedAt,
    updatedAt: publishedAt,
    draftRevision: 9,
    archivedAt: publishedAt,
    publication,
  };
  const pointer = {
    currentVersionId: input.currentVersionId,
    publishedRevision: publication.publishedRevision,
    publishedAt: publication.publishedAt,
    ...(overrides.pointer ?? {}),
  };
  const version = {
    presentationId: input.presentationId,
    presentationJson: "deliberately legacy and non-canonical published content",
    publishedRevision: publication.publishedRevision,
    publishedAt: publication.publishedAt,
    ...(overrides.version ?? {}),
  };
  await db.doc(`users/${input.ownerUid}/presentations/${input.presentationId}`).set(draft);
  await db.doc(`publishedPresentations/${input.publicationId}`).set(pointer);
  await db.doc(`publishedPresentations/${input.publicationId}/versions/${input.currentVersionId}`).set(version);
}

async function pointer(input) {
  return (await db.doc(`publishedPresentations/${input.publicationId}`).get()).data();
}

describe("publication owner backfill CLI parser", () => {
  const valid = ["--project-id", "p", "--owner-uid", "o", "--presentation-id", "d", "--publication-id", "u"];
  it("requires all explicit identifiers", () => assert.throws(() => parseArgs(["--project-id", "p"]), BackfillError));
  it("defaults to dry run and accepts apply", () => {
    assert.equal(parseArgs(valid).apply, false);
    assert.equal(parseArgs([...valid, "--apply"]).apply, true);
  });
  it("supports help", () => assert.equal(parseArgs(["--help"]).help, true));
  it("rejects unknown arguments", () => assert.throws(() => parseArgs([...valid, "--wat"]), BackfillError));
});

describe("publication owner backfill", () => {
  let input;
  beforeEach(() => { input = refs(); });

  it("reports a valid ownerless legacy pointer as dry-run ready", async () => {
    await seed(input);
    assert.deepEqual(await backfillPublicationOwner(db, input), { status: "DRY_RUN_READY" });
    assert.equal((await pointer(input)).ownerUid, undefined);
  });

  it("writes only ownerUid and preserves publication fields", async () => {
    await seed(input);
    assert.deepEqual(await backfillPublicationOwner(db, input, true), { status: "BACKFILLED" });
    assert.deepEqual(await pointer(input), { currentVersionId: input.currentVersionId, publishedRevision: 4, publishedAt, ownerUid: input.ownerUid });
    const saved = await db.doc(`publishedPresentations/${input.publicationId}`).get();
    assert.equal(saved.data().ownerUid, input.ownerUid);
  });

  it("is idempotent for the same owner", async () => {
    await seed(input, { pointer: { ownerUid: input.ownerUid } });
    assert.deepEqual(await backfillPublicationOwner(db, input, true), { status: "ALREADY_BOUND" });
  });

  it("rejects a different existing owner", async () => {
    await seed(input, { pointer: { ownerUid: "owner-other" } });
    await assert.rejects(backfillPublicationOwner(db, input, true), (error) => error.code === "pointer_owner_conflict");
    assert.equal((await pointer(input)).ownerUid, "owner-other");
  });

  it("does not discover a presentation under another owner", async () => {
    await seed({ ...input, ownerUid: "owner-other" });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "missing_draft");
  });

  it("requires an archived draft", async () => {
    await seed(input);
    await db.doc(`users/${input.ownerUid}/presentations/${input.presentationId}`).update({ archivedAt: null });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "draft_not_archived");
  });

  it("rejects supplied publication mismatch", async () => {
    await seed(input, { publication: { publicationId: "wrong" } });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "publication_id_mismatch");
  });

  it("rejects pointer metadata mismatch", async () => {
    await seed(input, { pointer: { currentVersionId: "wrong-version" } });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "pointer_metadata_mismatch");
    await seed(input, { pointer: { publishedRevision: 3 } });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "pointer_metadata_mismatch");
    await seed(input, { pointer: { publishedAt: Timestamp.fromMillis(2_000) } });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "pointer_metadata_mismatch");
  });

  it("rejects missing or inconsistent current version", async () => {
    await seed(input);
    await db.doc(`publishedPresentations/${input.publicationId}/versions/${input.currentVersionId}`).delete();
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "missing_current_version");
    await seed(input, { version: { presentationId: "wrong-presentation" } });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "current_version_presentation_mismatch");
    await seed(input, { version: { publishedRevision: 3 } });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "current_version_metadata_mismatch");
    await seed(input, { version: { publishedAt: Timestamp.fromMillis(2_000) } });
    await assert.rejects(backfillPublicationOwner(db, input), (error) => error.code === "current_version_metadata_mismatch");
  });

  it("allows legacy extra fields on the current version without parsing content", async () => {
    await seed(input, { version: { legacyField: "preserved" } });
    assert.deepEqual(await backfillPublicationOwner(db, input), { status: "DRY_RUN_READY" });
  });
});
