import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync(
  new URL("../../../firestore.rules", import.meta.url),
  "utf8",
);

describe("Firestore presentation record rules", () => {
  it("requires the strict draft record shape and operational field types", () => {
    expect(rules).toContain(
      "resource.keys().hasAll(['presentationJson', 'createdAt', 'updatedAt', 'draftRevision'])",
    );
    expect(rules).toContain(
      "resource.keys().hasOnly(['presentationJson', 'createdAt', 'updatedAt', 'draftRevision', 'folderId', 'archivedAt', 'publication'])",
    );
    expect(rules).toContain("resource.presentationJson is string");
    expect(rules).toContain("resource.createdAt is timestamp");
    expect(rules).toContain("resource.updatedAt is timestamp");
    expect(rules).toContain("resource.draftRevision is int");
  });

  it("keeps immutable version and authoritative equality invariants", () => {
    expect(rules).toContain(
      "resource.keys().hasOnly(['presentationId', 'presentationJson', 'publishedRevision', 'publishedAt'])",
    );
    expect(rules).toContain("resource.presentationId is string");
    expect(rules).toContain("resource.presentationJson == draft.data.presentationJson");
    expect(rules).toContain("version.data.presentationJson == draft.data.presentationJson");
    expect(rules).toContain("version.data.presentationId");
  });

  it("does not retain the legacy nested presentation rule shape", () => {
    expect(rules).not.toContain("resource.presentation is map");
    expect(rules).not.toContain("request.resource.data.presentation is map");
  });
});

// Returns the rules source starting at the first occurrence of fragment.
// Every fragment used below is asserted to exist by the tests that rely on it.
function rulesFrom(fragment: string): string {
  return rules.slice(rules.indexOf(fragment));
}

describe("Firestore archived publication deletion lifecycle rules", () => {
  it("keeps the public exact-get contract for pointers and versions", () => {
    expect(rules).toContain(
      "match /publishedPresentations/{publicationId} {\n      allow get: if true;",
    );
    const versions = rulesFrom(
      "match /publishedPresentations/{publicationId}/versions/{versionId}",
    );
    expect(versions).toContain("allow get: if true;");
  });

  it("keeps the pointer list forbidden", () => {
    expect(rules).toContain(
      "match /publishedPresentations/{publicationId} {\n      allow get: if true;\n\n      allow list: if false;",
    );
  });

  it("no longer makes the version list unconditionally false", () => {
    const versions = rulesFrom(
      "match /publishedPresentations/{publicationId}/versions/{versionId}",
    );
    expect(versions).not.toContain("allow list: if false;");
    expect(versions).toContain(
      "allow list: if isArchivedPublicationOwner(publicationId, request.auth.uid)",
    );
  });

  it("requires authentication for the version list", () => {
    const ownerContract = rulesFrom("function isArchivedPublicationOwner");
    expect(ownerContract).toContain("isSignedIn()");
    expect(ownerContract).toContain("pointer != null");
  });

  it("requires a bounded query limit for the version list", () => {
    const versions = rulesFrom(
      "match /publishedPresentations/{publicationId}/versions/{versionId}",
    );
    expect(versions).toContain("request.query.limit is int");
    expect(versions).toContain("request.query.limit > 0");
    expect(versions).toContain("request.query.limit <= 100");
  });

  it("does not consult request.query.where for list authorization", () => {
    expect(rules).not.toContain("request.query.where");
  });

  it("still forbids published-version updates", () => {
    const versions = rulesFrom(
      "match /publishedPresentations/{publicationId}/versions/{versionId}",
    );
    expect(versions).not.toContain("allow update");
  });

  it("authorizes historical version deletion through the archived-owner contract", () => {
    const versionDelete = rulesFrom("function archivedOwnerCanDeleteVersion");
    expect(versionDelete).toContain("isSignedIn()");
    expect(versionDelete).toContain("resource.data.presentationId is string");
    expect(versionDelete).toContain("archivedDraftOwnsPublication(");
    expect(versionDelete).toContain("pointerVersionReferencesDraft(");
  });

  it("requires projected pointer deletion when deleting the current version", () => {
    const versionDelete = rulesFrom("function archivedOwnerCanDeleteVersion");
    expect(versionDelete).toContain("versionId != pointer.data.currentVersionId");
    expect(versionDelete).toContain("!existsAfter(");
    expect(versionDelete).toContain(
      "/databases/$(database)/documents/publishedPresentations/$(publicationId)",
    );
  });

  it("requires projected current-version deletion when deleting the pointer", () => {
    const pointerDelete = rulesFrom("function archivedOwnerCanDeletePointer");
    expect(pointerDelete).toContain("!existsAfter(");
    expect(pointerDelete).toContain(
      "/versions/$(pointer.data.currentVersionId)",
    );
  });

  it("requires archived state for private draft deletion", () => {
    expect(rules).toContain(
      "allow delete: if isPrivatePresentationOwner(userId)\n        && archivedOwnerCanDeleteDraft();",
    );
    const draftDelete = rulesFrom("function archivedOwnerCanDeleteDraft");
    // Delete authorization must inspect the pre-operation draft through
    // resource.data, never the requested post-operation state.
    expect(draftDelete).toContain("let draft = resource.data;");
    expect(draftDelete).toContain("'archivedAt' in draft");
    expect(draftDelete).toContain("draft.archivedAt is timestamp");
    expect(draftDelete).not.toContain("let resource = request.resource.data;");
    expect(draftDelete).not.toContain("let draft = request.resource.data;");
  });

  it("keeps archived never-published draft deletion authorized", () => {
    const draftDelete = rulesFrom("function archivedOwnerCanDeleteDraft");
    expect(draftDelete).toContain("!('publication' in draft)");
  });

  it("requires the public pointer to be absent before deleting a published draft", () => {
    const draftDelete = rulesFrom("function archivedOwnerCanDeleteDraft");
    expect(draftDelete).toContain(
      "publicationMetadataHasValidShape(draft.publication)",
    );
    expect(draftDelete).toContain("!exists(");
    expect(draftDelete).toContain(
      "/databases/$(database)/documents/publishedPresentations/$(draft.publication.publicationId)",
    );
  });

  it("keeps active draft deletion unauthorized without the archived cleanup path", () => {
    expect(rules).not.toContain("allow delete: if isPrivatePresentationOwner(userId);");
  });

  it("keeps existing pointer create/update invariants", () => {
    expect(rules).toContain("allow create: if publishedPointerIsAuthoritative(");
    expect(rules).toContain("allow update: if publishedPointerIsAuthoritative(");
    expect(rules).toContain("publishedPointerHasValidShape()");
  });

  it("keeps existing published-version create invariants", () => {
    expect(rules).toContain("publishedVersionHasValidShape()");
    expect(rules).toContain("publishedVersionMatchesAuthoritativeDraft(");
    expect(rules).toContain("publishedVersionMatchesNewPointer(");
  });

  it("adds no public ownerId field", () => {
    expect(rules).not.toContain("ownerId");
  });

  it("keeps public pointer and version hasOnly contracts unchanged", () => {
    expect(rules).toContain(
      "resource.keys().hasOnly(['currentVersionId', 'publishedRevision', 'publishedAt'])",
    );
    expect(rules).toContain(
      "resource.keys().hasOnly(['presentationId', 'presentationJson', 'publishedRevision', 'publishedAt'])",
    );
  });
});
