import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: mocks.getFirebaseFirestore,
}));

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { FirestorePublishedPresentationReader } from "../src/features/persistence/firestore-published-presentation-reader";

const reader = new FirestorePublishedPresentationReader();

function versionData(presentation: unknown, overrides: Record<string, unknown> = {}) {
  return {
    presentation,
    publishedRevision: 3,
    publishedAt: "published",
    ...overrides,
  };
}

function snapshot(exists: boolean, data: unknown) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

describe("published presentation reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFirebaseFirestore.mockReturnValue({});
    mocks.doc.mockImplementation((...path: unknown[]) => ({ path }));
  });

  it("returns the canonical Presentation for a valid published version", async () => {
    const presentation = createBlankPresentation("pres-1");
    mocks.getDoc.mockResolvedValue(snapshot(true, versionData(presentation)));

    const result = await reader.getVersion("publication-1", "version-9");

    expect(result).toEqual(presentation);
  });

  it("returns null when the version document does not exist", async () => {
    mocks.getDoc.mockResolvedValue(snapshot(false, null));

    const result = await reader.getVersion("publication-1", "version-9");

    expect(result).toBeNull();
  });

  it("does not return malformed published data as a valid Presentation", async () => {
    mocks.getDoc.mockResolvedValue(
      snapshot(true, versionData({ id: "invalid", slides: "not-an-array" })),
    );

    await expect(
      reader.getVersion("publication-1", "version-9"),
    ).rejects.toThrow();
  });

  it("does not return a non-object version document as a Presentation", async () => {
    mocks.getDoc.mockResolvedValue(snapshot(true, "not-an-object"));

    await expect(
      reader.getVersion("publication-1", "version-9"),
    ).rejects.toThrow();
  });

  it("addresses the exact publicationId and versionId path", async () => {
    mocks.getDoc.mockResolvedValue(
      snapshot(true, versionData(createBlankPresentation("pres-1"))),
    );

    await reader.getVersion("publication-abc", "version-123");

    expect(mocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "publication-abc",
      "versions",
      "version-123",
    );
  });
});