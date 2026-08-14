import { describe, expect, it } from "vitest";

import {
  extractPresentationSummary,
  normalizePersistenceMetadata,
  resolvePublicationState,
} from "../src/features/persistence/presentation-persistence";

const publication = {
  currentVersionId: "v-1",
  publishedRevision: 2,
  publishedAt: "ts",
};

describe("publication state derivation", () => {
  it("resolves no publication to draft", () => {
    expect(resolvePublicationState(1, undefined)).toBe("draft");
  });

  it("resolves equal revisions to published", () => {
    expect(resolvePublicationState(2, publication)).toBe("published");
  });

  it("resolves differing revisions to unpublished-changes", () => {
    expect(resolvePublicationState(3, publication)).toBe("unpublished-changes");
  });
});

describe("persistence metadata normalization", () => {
  it("normalizes missing legacy draftRevision to zero", () => {
    expect(normalizePersistenceMetadata(undefined, undefined).draftRevision).toBe(0);
  });

  it("normalizes invalid draftRevision values to zero", () => {
    expect(normalizePersistenceMetadata("nope", undefined).draftRevision).toBe(0);
    expect(normalizePersistenceMetadata(-1, undefined).draftRevision).toBe(0);
  });

  it("normalizes non-integer or non-finite draftRevision to zero", () => {
    expect(normalizePersistenceMetadata(1.5, undefined).draftRevision).toBe(0);
    expect(normalizePersistenceMetadata(NaN, undefined).draftRevision).toBe(0);
    expect(normalizePersistenceMetadata(Infinity, undefined).draftRevision).toBe(0);
  });

  it("keeps valid integer draftRevision values unchanged", () => {
    expect(normalizePersistenceMetadata(0, undefined).draftRevision).toBe(0);
    expect(normalizePersistenceMetadata(1, undefined).draftRevision).toBe(1);
    expect(normalizePersistenceMetadata(42, undefined).draftRevision).toBe(42);
  });

  it("treats non-integer publishedRevision as malformed publication", () => {
    const result = normalizePersistenceMetadata(1, {
      currentVersionId: "v1",
      publishedRevision: 1.5,
      publishedAt: "ts",
    });

    expect(result.publication).toBeUndefined();
  });

  it("treats missing publishedAt as malformed publication", () => {
    const result = normalizePersistenceMetadata(1, {
      currentVersionId: "v1",
      publishedRevision: 1,
    });

    expect(result.publication).toBeUndefined();
  });

  it("treats malformed publication metadata as absent", () => {
    const result = normalizePersistenceMetadata(1, { currentVersionId: 1 });

    expect(result.publication).toBeUndefined();
  });

  it("keeps valid publication metadata", () => {
    const result = normalizePersistenceMetadata(1, publication);

    expect(result.publication).toEqual(publication);
  });
});

describe("summary extraction with publication metadata", () => {
  it("normalizes missing metadata on summary", () => {
    const summary = extractPresentationSummary({
      id: "pres-1",
      title: "Title",
      updatedAt: "ts",
    });

    expect(summary.draftRevision).toBe(0);
    expect(summary.publicationState).toBe("draft");
    expect(summary.publication).toBeUndefined();
  });

  it("derives published state from equal revisions", () => {
    const summary = extractPresentationSummary({
      id: "pres-1",
      title: "Title",
      updatedAt: "ts",
      draftRevision: 2,
      publication,
    });

    expect(summary.draftRevision).toBe(2);
    expect(summary.publicationState).toBe("published");
    expect(summary.publication).toEqual(publication);
  });

  it("derives unpublished-changes state from differing revisions", () => {
    const summary = extractPresentationSummary({
      id: "pres-1",
      title: "Title",
      updatedAt: "ts",
      draftRevision: 5,
      publication,
    });

    expect(summary.publicationState).toBe("unpublished-changes");
  });

  it("treats malformed publication safely and keeps the summary viable", () => {
    const summary = extractPresentationSummary({
      id: "pres-1",
      title: "Title",
      updatedAt: "ts",
      draftRevision: 3,
      publication: { currentVersionId: 1 },
    });

    expect(summary.publication).toBeUndefined();
    expect(summary.publicationState).toBe("draft");
    expect(summary.id).toBe("pres-1");
    expect(summary.title).toBe("Title");
  });
});