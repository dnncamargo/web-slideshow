import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Presentation } from "@web-slideshow/document-schema";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  increment: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn(),
  })),
  deleteField: vi.fn(() => "__delete_field__"),
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: vi.fn(() => ({
    uid: "user-1",
    isAnonymous: false,
  })),
}));

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { FirestorePresentationRepository } from "../src/features/persistence/firestore-presentation-repository";
import { encodePresentationForFirestore } from "@web-slideshow/firebase";
import {
  extractPresentationSummary,
  normalizeFolderId,
} from "../src/features/persistence/presentation-persistence";

import {
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "../src/features/persistence/firebase-client";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";

const mockedDeleteField = vi.mocked(deleteField);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedIncrement = vi.mocked(increment);
const mockedQuery = vi.mocked(query);
const mockedRunTransaction = vi.mocked(runTransaction);
const mockedServerTimestamp = vi.mocked(serverTimestamp);
const mockedSetDoc = vi.mocked(setDoc);
const mockedUpdateDoc = vi.mocked(updateDoc);
const mockedWriteBatch = vi.mocked(writeBatch);
const mockedGetFirestore = vi.mocked(getFirebaseFirestore);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);

const repository = new FirestorePresentationRepository();

function presentationDoc(id: string, overrides: Record<string, unknown> = {}) {
  const presentation = createBlankPresentation(id);
  return {
    presentationJson: encodePresentationForFirestore(presentation).presentationJson,
    createdAt: "created",
    updatedAt: "updated",
    draftRevision: 1,
    ...overrides,
  };
}

function recoverableScriptedDocument(id: string, overrides: Record<string, unknown> = {}) {
  const presentation = createBlankPresentation(id);
  presentation.slides = [{
    id: "slide-1",
    title: "",
    summary: "",
    speakerNotes: "",
    elements: [{
      id: "scripted-1",
      type: "scripted",
      title: "Counter",
      html: "",
      css: "",
      script: "",
      ports: [{ id: "increment", label: "Incrementar", kind: "action" }],
      futurePortContract: true,
    } as unknown as Presentation["slides"][number]["elements"][number]],
  }];

  return {
    ...presentationDoc(id, overrides),
    presentationJson: JSON.stringify(presentation),
  };
}

function unrecoverableDocument(overrides: Record<string, unknown> = {}) {
  return {
    presentationJson: JSON.stringify({ schemaVersion: 1, slides: "invalid" }),
    createdAt: "created",
    updatedAt: "updated",
    draftRevision: 1,
    ...overrides,
  };
}

function snapshotWith(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>,
) {
  mockedGetDocs.mockResolvedValue({ docs } as never);
}

describe("summary organization normalization", () => {
  it("normalizes a valid folderId", () => {
    const summary = extractPresentationSummary({
      id: "pres-1",
      title: "Title",
      updatedAt: "ts",
      folderId: "folder-1",
    });

    expect(summary.folderId).toBe("folder-1");
  });

  it("normalizes malformed and empty folderId to null", () => {
    expect(
      extractPresentationSummary({
        id: "p",
        title: "T",
        updatedAt: "ts",
        folderId: 42,
      }).folderId,
    ).toBeNull();
    expect(
      extractPresentationSummary({
        id: "p",
        title: "T",
        updatedAt: "ts",
        folderId: null,
      }).folderId,
    ).toBeNull();
    expect(
      extractPresentationSummary({
        id: "p",
        title: "T",
        updatedAt: "ts",
        folderId: "",
      }).folderId,
    ).toBeNull();
    expect(
      extractPresentationSummary({
        id: "p",
        title: "T",
        updatedAt: "ts",
        folderId: {},
      }).folderId,
    ).toBeNull();
    expect(
      extractPresentationSummary({ id: "p", title: "T", updatedAt: "ts" })
        .folderId,
    ).toBeNull();
  });

  it("derives archived from archivedAt with a nullable field", () => {
    const active = extractPresentationSummary({
      id: "p",
      title: "T",
      updatedAt: "ts",
    });
    expect(active.archived).toBe(false);
    expect(active.archivedAt).toBeNull();

    const archived = extractPresentationSummary({
      id: "p",
      title: "T",
      updatedAt: "ts",
      archivedAt: "archive-ts",
    });
    expect(archived.archived).toBe(true);
    expect(archived.archivedAt).toBe("archive-ts");
  });

  it("normalizes folderId via the exported helper", () => {
    expect(normalizeFolderId("folder-1")).toBe("folder-1");
    expect(normalizeFolderId("")).toBeNull();
    expect(normalizeFolderId("   ")).toBeNull();
    expect(normalizeFolderId(123)).toBeNull();
    expect(normalizeFolderId(undefined)).toBeNull();
  });

  it("preserves the original folderId string without trimming", () => {
    expect(normalizeFolderId("  folder-1  ")).toBe("  folder-1  ");
  });
});

describe("listPresentations organization filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
  });

  it("omits archived documents by default", async () => {
    snapshotWith([
      { id: "pres-a", data: () => presentationDoc("pres-a") },
      {
        id: "pres-b",
        data: () =>
          presentationDoc("pres-b", {
            archivedAt: "archived",
            folderId: "folder-1",
          }),
      },
    ]);

    const summaries = await repository.listPresentations();

    expect(summaries.map((summary) => summary.id)).toEqual(["pres-a"]);
  });

  it("returns active and archived summaries with includeArchived", async () => {
    snapshotWith([
      {
        id: "pres-a",
        data: () => presentationDoc("pres-a", { folderId: "folder-1" }),
      },
      {
        id: "pres-b",
        data: () =>
          presentationDoc("pres-b", {
            archivedAt: "archived",
            folderId: "folder-1",
          }),
      },
    ]);

    const summaries = await repository.listPresentations({
      includeArchived: true,
    });

    expect(summaries.map((summary) => summary.id)).toEqual([
      "pres-a",
      "pres-b",
    ]);

    const archived = summaries.find((summary) => summary.id === "pres-b");
    expect(archived?.archived).toBe(true);
    expect(archived?.folderId).toBe("folder-1");
  });

  it("reads the collection once regardless of includeArchived", async () => {
    snapshotWith([{ id: "pres-a", data: () => presentationDoc("pres-a") }]);

    await repository.listPresentations({ includeArchived: true });

    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects a draft whose canonical id differs from its Firestore document id", async () => {
    snapshotWith([{ id: "pres-path", data: () => presentationDoc("pres-canonical") }]);

    await expect(repository.listPresentations()).rejects.toThrow(/identity mismatch/i);
  });

  it("surfaces a recoverable non-canonical draft using only document-owned summary metadata", async () => {
    snapshotWith([{
      id: "pres-recoverable",
      data: () => recoverableScriptedDocument("pres-recoverable", {
        folderId: "folder-1",
        draftRevision: 4,
        publication: {
          publicationId: "publication-1",
          currentVersionId: "version-1",
          publishedRevision: 3,
          publishedAt: "published",
        },
      }),
    }]);

    const summaries = await repository.listPresentations();

    expect(summaries).toEqual([expect.objectContaining({
      id: "pres-recoverable",
      title: "Untitled presentation",
      archived: false,
      archivedAt: null,
      folderId: "folder-1",
      draftRevision: 4,
      publicationState: "unpublished-changes",
    })]);
    expect(summaries[0]?.thumbnailPreview).toBeUndefined();
    expect(mockedSetDoc).not.toHaveBeenCalled();
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedRunTransaction).not.toHaveBeenCalled();
  });

  it("keeps recoverable drafts in the same active, archived, and folder destinations", async () => {
    snapshotWith([
      { id: "active", data: () => recoverableScriptedDocument("active", { folderId: "folder-1" }) },
      { id: "archived", data: () => recoverableScriptedDocument("archived", { archivedAt: "archived", folderId: "folder-2" }) },
    ]);

    await expect(repository.listPresentations()).resolves.toMatchObject([
      { id: "active", archived: false, folderId: "folder-1" },
    ]);
    await expect(repository.listPresentations({ includeArchived: true })).resolves.toMatchObject([
      { id: "active", archived: false, folderId: "folder-1" },
      { id: "archived", archived: true, archivedAt: "archived", folderId: "folder-2" },
    ]);
  });

  it("surfaces an unrecoverable draft with the existing neutral Library title", async () => {
    snapshotWith([{ id: "pres-unrecoverable", data: () => unrecoverableDocument() }]);

    await expect(repository.listPresentations()).resolves.toEqual([
      expect.objectContaining({ id: "pres-unrecoverable", title: "", archived: false }),
    ]);
  });
});

describe("draft identity validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
    mockedDoc.mockReturnValue({ id: "pres-path" } as never);
  });

  it("rejects an individually loaded draft whose canonical id differs from its path", async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => presentationDoc("pres-canonical"),
    } as never);

    await expect(repository.getPresentation("pres-path")).rejects.toThrow(
      /identity mismatch/i,
    );
  });
});

describe("archive and restore semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedDoc.mockReturnValue({ id: "pres-1" } as never);
    mockedServerTimestamp.mockReturnValue("server-ts" as never);
  });

  it("archives by writing only archivedAt", async () => {
    await repository.archivePresentation("pres-1");

    expect(mockedUpdateDoc).toHaveBeenCalledWith(
      { id: "pres-1" },
      { archivedAt: "server-ts" },
    );
    expect(mockedIncrement).not.toHaveBeenCalled();
  });

  it("restores by removing archivedAt with deleteField", async () => {
    await repository.restorePresentation("pres-1");

    expect(mockedDeleteField).toHaveBeenCalled();
    expect(mockedUpdateDoc).toHaveBeenCalledWith(
      { id: "pres-1" },
      { archivedAt: "__delete_field__" },
    );
    expect(mockedIncrement).not.toHaveBeenCalled();
  });

  it("never writes folderId during archive or restore", async () => {
    await repository.archivePresentation("pres-1");
    expect(mockedUpdateDoc.mock.calls[0]?.[1]).not.toHaveProperty("folderId");

    await repository.restorePresentation("pres-1");
    expect(mockedUpdateDoc.mock.calls[1]?.[1]).not.toHaveProperty("folderId");
  });
});

describe("presentation folder moves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedDoc.mockReturnValue({ id: "pres-1" } as never);
  });

  it("writes only the top-level folderId when moving into a folder", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => true } as never);

    await repository.movePresentationToFolder("pres-1", "folder-1");

    expect(mockedGetDoc).toHaveBeenCalled();
    expect(mockedUpdateDoc).toHaveBeenCalledWith(
      { id: "pres-1" },
      { folderId: "folder-1" },
    );
    expect(mockedIncrement).not.toHaveBeenCalled();
  });

  it("removes folderId cleanly when moving to null", async () => {
    await repository.movePresentationToFolder("pres-1", null);

    expect(mockedDeleteField).toHaveBeenCalled();
    expect(mockedUpdateDoc).toHaveBeenCalledWith(
      { id: "pres-1" },
      { folderId: "__delete_field__" },
    );
    expect(mockedGetDoc).not.toHaveBeenCalled();
    expect(mockedIncrement).not.toHaveBeenCalled();
  });

  it("rejects a move into a missing folder without logging an error", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        repository.movePresentationToFolder("pres-1", "missing"),
      ).rejects.toThrow(/missing folder/i);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }

    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it("does not modify draftRevision, updatedAt, publication, or the canonical presentation", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => true } as never);

    await repository.movePresentationToFolder("pres-1", "folder-1");

    const payload = mockedUpdateDoc.mock.calls[0]?.[1] as unknown as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty("draftRevision");
    expect(payload).not.toHaveProperty("updatedAt");
    expect(payload).not.toHaveProperty("publication");
    expect(payload).not.toHaveProperty("presentation");
    expect(mockedIncrement).not.toHaveBeenCalled();
  });
});

describe("create presentation in folder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedDoc.mockReturnValue({ id: "pres-1" } as never);
    mockedServerTimestamp.mockReturnValue("server-ts" as never);
  });

  it("remains backward compatible with a single argument", async () => {
    const presentation = createBlankPresentation("pres-1");

    await repository.createPresentation(presentation);

    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentations",
      "pres-1",
    );
    const payload = mockedSetDoc.mock.calls[0]?.[1] as unknown as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty("folderId");
    expect(payload).toMatchObject({ draftRevision: 1 });
  });

  it("stores folderId outside the canonical presentation object", async () => {
    const presentation = createBlankPresentation("pres-1");

    await repository.createPresentation(presentation, { folderId: "folder-1" });

    const payload = mockedSetDoc.mock.calls[0]?.[1] as unknown as Record<
      string,
      unknown
    >;
    expect(payload?.folderId).toBe("folder-1");
    expect(payload?.presentationJson).toEqual(expect.any(String));
    const persisted = JSON.parse(payload.presentationJson as string) as Record<string, unknown>;
    expect(persisted).not.toHaveProperty("folderId");
    expect(persisted).toEqual(
      expect.objectContaining({ id: "pres-1" }),
    );
  });
});

describe("permanently deleting archived presentations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDoc.mockReset();
    mockedGetDocs.mockReset();
    mockedWriteBatch.mockReset();
    mockedWriteBatch.mockImplementation(() => ({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    }) as never);
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedDoc.mockReturnValue({ id: "pres-1" } as never);
  });

  function publishedDraft(overrides: Record<string, unknown> = {}) {
    return presentationDoc("pres-1", {
      archivedAt: "archived",
      publication: {
        publicationId: "pub-1",
        currentVersionId: "current-1",
        publishedRevision: 3,
        publishedAt: "published",
      },
      ...overrides,
    });
  }

  function publishedVersion(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      presentationId: "pres-1",
      presentationJson: JSON.stringify({ published: true }),
      publishedRevision: 3,
      publishedAt: "published",
      ...overrides,
    };
  }

  function setupPublishedDelete(options: {
    pointer?: Record<string, unknown>;
    current?: Record<string, unknown> | null;
    historical?: Array<{ id: string; data: Record<string, unknown> }>;
    historicalPages?: Array<Array<{ id: string; data: Record<string, unknown> }>>;
    historicalCommitFailure?: boolean;
  } = {}) {
    mockedDoc.mockImplementation((...path: unknown[]) => ({ path }) as never);
    const batches: Array<{ delete: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> }> = [];
    mockedWriteBatch.mockImplementation(() => {
      const batch = {
        delete: vi.fn(),
        commit: options.historicalCommitFailure
          ? vi.fn().mockRejectedValue(new Error("historical failure"))
          : vi.fn().mockResolvedValue(undefined),
      };
      batches.push(batch);
      return batch as never;
    });
    mockedGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => publishedDraft() } as never)
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => options.pointer ?? {
          ownerUid: "user-1",
          currentVersionId: "current-1",
          publishedRevision: 3,
          publishedAt: "published",
        },
      } as never)
      .mockResolvedValueOnce({
        exists: () => options.current !== null,
        data: () => options.current ?? publishedVersion(),
      } as never);
    const pages = options.historicalPages ?? [options.historical ?? []];
    for (const page of pages) {
      mockedGetDocs.mockResolvedValueOnce({
        docs: page.map((entry) => ({ id: entry.id, ref: { id: entry.id }, data: () => entry.data })),
      } as never);
    }
    if (pages.length > 0) {
      mockedGetDocs.mockResolvedValueOnce({ docs: [] } as never);
    }
    return batches;
  }

  it("rejects a missing draft without deleting", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        repository.deleteArchivedPresentation("pres-1"),
      ).rejects.toThrow(/missing/i);
      expect(mockedWriteBatch).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("rejects an active (non-archived) draft without deleting", async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => presentationDoc("pres-a"),
    } as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        repository.deleteArchivedPresentation("pres-1"),
      ).rejects.toThrow(/non-archived/i);
      expect(mockedWriteBatch).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("fails closed when a published archived draft has no public pointer", async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () =>
        presentationDoc("pres-a", {
          archivedAt: "archived",
          publication: {
            publicationId: "pub-1",
            currentVersionId: "version-1",
            publishedRevision: 1,
            publishedAt: "ts",
          },
        }),
    } as never);
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => presentationDoc("pres-a", {
        archivedAt: "archived",
        publication: {
          publicationId: "pub-1",
          currentVersionId: "version-1",
          publishedRevision: 1,
          publishedAt: "ts",
        },
      }),
    } as never).mockResolvedValueOnce({ exists: () => false } as never);

    await expect(repository.deleteArchivedPresentation("pres-1"))
      .rejects.toThrow(/pointer is missing/i);
    expect(mockedWriteBatch).not.toHaveBeenCalled();
  });

  it("deletes only the private draft for an eligible archived unpublished item", async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () =>
        presentationDoc("pres-a", {
          archivedAt: "archived",
          folderId: "folder-1",
        }),
    } as never);

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedWriteBatch).toHaveBeenCalledTimes(1);
    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentations",
      "pres-1",
    );
  });

  it("writes only the delete and no draftRevision, updatedAt, publication, or canonical mutations", async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => presentationDoc("pres-a", { archivedAt: "archived" }),
    } as never);

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedWriteBatch).toHaveBeenCalledTimes(1);
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
    expect(mockedIncrement).not.toHaveBeenCalled();
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });
  it("rejects an archived draft with malformed publication metadata", async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () =>
        presentationDoc("pres-a", {
          archivedAt: "archived",
          publication: { unexpected: true },
        }),
    } as never);

    await expect(
      repository.deleteArchivedPresentation("pres-1"),
    ).rejects.toThrow(/published/i);

    expect(mockedWriteBatch).not.toHaveBeenCalled();
  });

  it.each([
    ["ownerless pointer", { currentVersionId: "current-1", publishedRevision: 3, publishedAt: "published" }],
    ["wrong owner", { ownerUid: "other", currentVersionId: "current-1", publishedRevision: 3, publishedAt: "published" }],
    ["mismatched current version", { ownerUid: "user-1", currentVersionId: "other", publishedRevision: 3, publishedAt: "published" }],
    ["mismatched revision", { ownerUid: "user-1", currentVersionId: "current-1", publishedRevision: 4, publishedAt: "published" }],
    ["mismatched timestamp", { ownerUid: "user-1", currentVersionId: "current-1", publishedRevision: 3, publishedAt: "other" }],
  ])("fails closed for %s", async (_label, pointer) => {
    setupPublishedDelete({ pointer });

    await expect(repository.deleteArchivedPresentation("pres-1")).rejects.toThrow(/pointer/i);
    expect(mockedWriteBatch).not.toHaveBeenCalled();
  });

  it("deletes an owner-bound publication with exactly the four final documents", async () => {
    const batches = setupPublishedDelete();

    await repository.deleteArchivedPresentation("pres-1");

    expect(batches).toHaveLength(1);
    expect(batches[0]?.delete).toHaveBeenCalledTimes(4);
    expect(batches[0]?.delete.mock.calls.map(([ref]) => ref.path.slice(1).join("/"))).toEqual([
      "publishedPresentations/pub-1/versions/current-1",
      "publishedPresentations/pub-1",
      "users/user-1/presentations/pres-1/private/notes",
      "users/user-1/presentations/pres-1",
    ]);
  });

  it.each([
    ["missing current version", null],
    ["wrong presentation id", publishedVersion({ presentationId: "other" })],
    ["malformed current version", { unexpected: true }],
    ["mismatched current revision", publishedVersion({ publishedRevision: 4 })],
    ["mismatched current timestamp", publishedVersion({ publishedAt: "other" })],
  ])("rejects %s before destructive cleanup", async (_label, current) => {
    setupPublishedDelete({ current });

    await expect(repository.deleteArchivedPresentation("pres-1")).rejects.toThrow(/published version|current published version/i);
    expect(mockedWriteBatch).not.toHaveBeenCalled();
  });

  it.each([
    ["zero historical versions", []],
    ["one historical version", [{ id: "history-1", data: publishedVersion({ publishedRevision: 2, publishedAt: "older" }) }]],
    ["several historical versions", [
      { id: "history-1", data: publishedVersion({ publishedRevision: 1, publishedAt: "old-1" }) },
      { id: "history-2", data: publishedVersion({ publishedRevision: 2, publishedAt: "old-2" }) },
    ]],
  ])("handles %s without removing the current version", async (_label, historical) => {
    const batches = setupPublishedDelete({ historical });

    await repository.deleteArchivedPresentation("pres-1");

    expect(batches.at(-1)?.delete.mock.calls.map(([ref]) => ref.path.slice(1).join("/"))).toContain(
      "publishedPresentations/pub-1/versions/current-1",
    );
    expect(batches.at(-1)?.delete.mock.calls.map(([ref]) => ref.path.slice(1).join("/"))).not.toContain(
      "publishedPresentations/pub-1/versions/history-1",
    );
  });

  it("processes historical versions in repeated bounded pages and stops before the final batch", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `history-${index}`,
      data: publishedVersion({ publishedRevision: index, publishedAt: `old-${index}` }),
    }));
    const secondPage = [{ id: "history-100", data: publishedVersion({ publishedRevision: 100, publishedAt: "old-100" }) }];
    const batches = setupPublishedDelete({ historicalPages: [firstPage, secondPage] });

    await repository.deleteArchivedPresentation("pres-1");

    expect(batches).toHaveLength(3);
    expect(batches[0]?.delete).toHaveBeenCalledTimes(100);
    expect(batches[1]?.delete).toHaveBeenCalledTimes(1);
    expect(batches[2]?.delete).toHaveBeenCalledTimes(4);
  });

  it("rejects malformed or cross-presentation historical versions before its batch", async () => {
    setupPublishedDelete({ historical: [{ id: "history-1", data: publishedVersion({ presentationId: "other" }) }] });

    await expect(repository.deleteArchivedPresentation("pres-1")).rejects.toThrow(/published version/i);
    expect(mockedWriteBatch).not.toHaveBeenCalled();
  });

  it("stops before the final batch when a historical batch fails", async () => {
    const batches = setupPublishedDelete({
      historical: [{ id: "history-1", data: publishedVersion({ publishedRevision: 2, publishedAt: "older" }) }],
      historicalCommitFailure: true,
    });

    await expect(repository.deleteArchivedPresentation("pres-1")).rejects.toThrow(/failed to delete/i);
    expect(batches).toHaveLength(1);
  });
});
