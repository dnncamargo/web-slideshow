import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Presentation } from "@powershow/document-schema";

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
  writeBatch: vi.fn(),
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
import { encodePresentationForFirestore } from "@powershow/firebase";
import {
  extractPresentationSummary,
  normalizeFolderId,
} from "../src/features/persistence/presentation-persistence";

import {
  collection,
  deleteDoc,
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

const mockedCollection = vi.mocked(collection);
const mockedDeleteDoc = vi.mocked(deleteDoc);
const mockedDeleteField = vi.mocked(deleteField);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedIncrement = vi.mocked(increment);
const mockedLimit = vi.mocked(limit);
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
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedDoc.mockReturnValue({ id: "pres-1" } as never);
  });

  it("rejects a missing draft without deleting", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        repository.deleteArchivedPresentation("pres-1"),
      ).rejects.toThrow(/missing/i);
      expect(mockedDeleteDoc).not.toHaveBeenCalled();
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
      expect(mockedDeleteDoc).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
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

    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockedGetDoc).toHaveBeenCalledTimes(1);
    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(mockedWriteBatch).not.toHaveBeenCalled();
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

    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
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

    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Published-presentation cleanup fixtures. The document refs are explicit
// objects so assertions can verify exact public paths and batch membership.
// ---------------------------------------------------------------------------

const DRAFT_REF = { id: "draft-ref" };
const POINTER_REF = { id: "pointer-ref" };
const CURRENT_VERSION_REF = { id: "current-version-ref" };
const VERSIONS_COLLECTION_REF = { kind: "versions-collection" };

function publishedPublicationMetadata(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    publicationId: "pub-1",
    currentVersionId: "version-current",
    publishedRevision: 1,
    publishedAt: "published-ts",
    ...overrides,
  };
}

function publishedDraftData(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return presentationDoc("pres-1", {
    archivedAt: "archived",
    publication: publishedPublicationMetadata(),
    ...overrides,
  });
}

function publishedPointerData(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    currentVersionId: "version-current",
    publishedRevision: 1,
    publishedAt: "published-ts",
    ...overrides,
  };
}

function publishedVersionDocument(id: string, presentationId: string) {
  return {
    id,
    data: () => ({
      presentationId,
      presentationJson: JSON.stringify({
        schemaVersion: 1,
        id: presentationId,
        slides: [],
      }),
      publishedRevision: 1,
      publishedAt: "published-ts",
    }),
    ref: { id, kind: "version-ref" },
  };
}

function versionsSnapshot(docs: Array<unknown>) {
  return { docs } as never;
}

function recordedBatch(index: number): { delete: Mock; commit: Mock } {
  const batch = mockedWriteBatch.mock.results[index]?.value;
  if (batch === undefined) {
    throw new Error(`Expected writeBatch invocation #${index} to exist.`);
  }

  return batch as unknown as { delete: Mock; commit: Mock };
}

/**
 * Configures the shared delete-flow mocks for an archived published draft.
 * The draft is always the first document read and the pointer the second.
 */
function configurePublishedDelete(
  options: {
    pointerExists?: boolean;
    pointerData?: Record<string, unknown>;
    draftData?: Record<string, unknown>;
  } = {},
) {
  const refQueue: Array<unknown> = [
    DRAFT_REF,
    POINTER_REF,
    CURRENT_VERSION_REF,
  ];
  mockedDoc.mockImplementation(
    (() => {
      const next = refQueue.shift();
      return next === undefined ? DRAFT_REF : next;
    }) as never,
  );
  mockedCollection.mockReturnValue(VERSIONS_COLLECTION_REF as never);

  const draft = options.draftData ?? publishedDraftData();
  const pointer = options.pointerData ?? publishedPointerData();
  mockGetDocSequence(
    Promise.resolve({ exists: () => true, data: () => draft } as never),
    Promise.resolve({
      exists: () => options.pointerExists ?? true,
      data: () => pointer,
    } as never),
  );
}

function mockGetDocSequence(...responses: Array<Promise<unknown>>) {
  const queue = [...responses];
  mockedGetDoc.mockImplementation(
    (() => {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error("Unexpected extra document read.");
      }

      return next;
    }) as never,
  );
}

function mockGetDocsSequence(
  responses: Array<Promise<unknown>>,
  events?: string[],
) {
  const queue = [...responses];
  mockedGetDocs.mockImplementation(
    (() => {
      events?.push("listVersions");
      const next = queue.shift();
      if (next === undefined) {
        throw new Error("Unexpected extra version list query.");
      }

      return next;
    }) as never,
  );
}

describe("permanently deleting archived published presentations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedLimit.mockImplementation(((value: number) => ({ limit: value })) as never);
    mockedQuery.mockImplementation(
      ((reference: unknown, queryLimit: unknown) => ({
        reference,
        queryLimit,
      })) as never,
    );
    mockedWriteBatch.mockImplementation(
      (() => ({
        delete: vi.fn(),
        commit: vi.fn(async () => {}),
      })) as never,
    );
  });

  it("deletes a published presentation through history batch, final batch, and draft last", async () => {
    configurePublishedDelete();
    const events: string[] = [];
    mockedWriteBatch.mockImplementation(
      (() => ({
        delete: vi.fn(),
        commit: vi.fn(async () => {
          events.push("batchCommit");
        }),
      })) as never,
    );
    mockedDeleteDoc.mockImplementation(
      (async () => {
        events.push("draftDelete");
      }) as never,
    );
    const historical1 = publishedVersionDocument("version-hist-1", "pres-1");
    const historical2 = publishedVersionDocument("version-hist-2", "pres-1");
    const current = publishedVersionDocument("version-current", "pres-1");
    mockGetDocsSequence(
      [
        Promise.resolve(versionsSnapshot([historical1, historical2])),
        Promise.resolve(versionsSnapshot([current])),
      ],
      events,
    );

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedCollection).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "pub-1",
      "versions",
    );
    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "pub-1",
    );
    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "pub-1",
      "versions",
      "version-current",
    );

    expect(mockedGetDocs).toHaveBeenCalledTimes(2);
    const queryCalls = mockedQuery.mock.calls as unknown as Array<
      Array<unknown>
    >;
    expect(queryCalls).toHaveLength(2);
    queryCalls.forEach((call) => {
      expect(call).toHaveLength(2);
      expect(call[0]).toBe(VERSIONS_COLLECTION_REF);
    });
    expect(mockedLimit.mock.calls).toEqual([[100], [100]]);
    expect(queryCalls[0]?.[1]).toBe(mockedLimit.mock.results[0]?.value);

    const historyBatch = recordedBatch(0);
    expect(historyBatch.delete.mock.calls.map((call) => call[0])).toEqual([
      historical1.ref,
      historical2.ref,
    ]);
    expect(historyBatch.commit).toHaveBeenCalledTimes(1);

    const finalBatch = recordedBatch(1);
    expect(finalBatch.delete.mock.calls.map((call) => call[0])).toEqual([
      CURRENT_VERSION_REF,
      POINTER_REF,
    ]);
    expect(finalBatch.commit).toHaveBeenCalledTimes(1);

    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).toHaveBeenCalledWith(DRAFT_REF);
    expect(events).toEqual([
      "listVersions",
      "batchCommit",
      "listVersions",
      "batchCommit",
      "draftDelete",
    ]);
  });

  it("deletes the current version and public pointer in one batch, never sequential deleteDoc calls", async () => {
    configurePublishedDelete();
    const current = publishedVersionDocument("version-current", "pres-1");
    mockGetDocsSequence([Promise.resolve(versionsSnapshot([current]))]);

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedWriteBatch).toHaveBeenCalledTimes(1);
    const finalBatch = recordedBatch(0);
    expect(finalBatch.delete.mock.calls.map((call) => call[0])).toEqual([
      CURRENT_VERSION_REF,
      POINTER_REF,
    ]);
    expect(finalBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).toHaveBeenCalledWith(DRAFT_REF);
  });

  it("deletes the private draft only after public batch commits resolve", async () => {
    configurePublishedDelete();
    const events: string[] = [];
    let releaseCommit: () => void = () => {};
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    mockedWriteBatch.mockImplementation(
      (() => ({
        delete: vi.fn(),
        commit: vi.fn(async () => {
          events.push("commitStarted");
          await commitGate;
          events.push("commitResolved");
        }),
      })) as never,
    );
    mockedDeleteDoc.mockImplementation(
      (async () => {
        events.push("draftDelete");
      }) as never,
    );
    const current = publishedVersionDocument("version-current", "pres-1");
    mockGetDocsSequence([Promise.resolve(versionsSnapshot([current]))]);

    const operation = repository.deleteArchivedPresentation("pres-1");

    await vi.waitFor(() => expect(events).toContain("commitStarted"));
    expect(events).not.toContain("draftDelete");
    releaseCommit();
    await operation;

    expect(events).toEqual(["commitStarted", "commitResolved", "draftDelete"]);
  });

  it("treats a missing pointer as completed public cleanup and deletes only the draft", async () => {
    configurePublishedDelete({ pointerExists: false });

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).toHaveBeenCalledWith(DRAFT_REF);
  });

  it("performs one final public batch for a single current version with no history", async () => {
    configurePublishedDelete();
    const current = publishedVersionDocument("version-current", "pres-1");
    mockGetDocsSequence([Promise.resolve(versionsSnapshot([current]))]);

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    expect(mockedWriteBatch).toHaveBeenCalledTimes(1);
    const finalBatch = recordedBatch(0);
    expect(finalBatch.delete.mock.calls.map((call) => call[0])).toEqual([
      CURRENT_VERSION_REF,
      POINTER_REF,
    ]);
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).toHaveBeenCalledWith(DRAFT_REF);
  });
});

describe("published cleanup pagination loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedLimit.mockImplementation(((value: number) => ({ limit: value })) as never);
    mockedQuery.mockImplementation(
      ((reference: unknown, queryLimit: unknown) => ({
        reference,
        queryLimit,
      })) as never,
    );
    mockedWriteBatch.mockImplementation(
      (() => ({
        delete: vi.fn(),
        commit: vi.fn(async () => {}),
      })) as never,
    );
  });

  it("deletes only historical versions from a mixed current+history page, then re-queries", async () => {
    configurePublishedDelete();
    const current = publishedVersionDocument("version-current", "pres-1");
    const historical = publishedVersionDocument("version-hist-1", "pres-1");
    mockGetDocsSequence([
      Promise.resolve(versionsSnapshot([current, historical])),
      Promise.resolve(versionsSnapshot([current])),
    ]);

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedGetDocs).toHaveBeenCalledTimes(2);
    const historyBatch = recordedBatch(0);
    expect(historyBatch.delete.mock.calls.map((call) => call[0])).toEqual([
      historical.ref,
    ]);
    expect(historyBatch.delete).not.toHaveBeenCalledWith(CURRENT_VERSION_REF);
    const finalBatch = recordedBatch(1);
    expect(finalBatch.delete.mock.calls.map((call) => call[0])).toEqual([
      CURRENT_VERSION_REF,
      POINTER_REF,
    ]);
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it("completes multiple historical pages before the final batch", async () => {
    configurePublishedDelete();
    const historical1 = publishedVersionDocument("version-hist-1", "pres-1");
    const historical2 = publishedVersionDocument("version-hist-2", "pres-1");
    const historical3 = publishedVersionDocument("version-hist-3", "pres-1");
    const current = publishedVersionDocument("version-current", "pres-1");
    mockGetDocsSequence([
      Promise.resolve(versionsSnapshot([historical1, historical2])),
      Promise.resolve(versionsSnapshot([historical3])),
      Promise.resolve(versionsSnapshot([current])),
    ]);

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedGetDocs).toHaveBeenCalledTimes(3);
    expect(mockedWriteBatch).toHaveBeenCalledTimes(3);
    expect(mockedLimit.mock.calls).toEqual([[100], [100], [100]]);

    const firstHistoryBatch = recordedBatch(0);
    expect(
      firstHistoryBatch.delete.mock.calls.map((call) => call[0]),
    ).toEqual([historical1.ref, historical2.ref]);
    expect(firstHistoryBatch.commit).toHaveBeenCalledTimes(1);

    const secondHistoryBatch = recordedBatch(1);
    expect(
      secondHistoryBatch.delete.mock.calls.map((call) => call[0]),
    ).toEqual([historical3.ref]);
    expect(secondHistoryBatch.commit).toHaveBeenCalledTimes(1);

    const finalBatch = recordedBatch(2);
    expect(finalBatch.delete.mock.calls.map((call) => call[0])).toEqual([
      CURRENT_VERSION_REF,
      POINTER_REF,
    ]);
    expect(finalBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it("issues every versions list query as a bounded limit(100) query with no extra query clauses", async () => {
    configurePublishedDelete();
    const historical = publishedVersionDocument("version-hist-1", "pres-1");
    const current = publishedVersionDocument("version-current", "pres-1");
    mockGetDocsSequence([
      Promise.resolve(versionsSnapshot([historical])),
      Promise.resolve(versionsSnapshot([current])),
    ]);

    await repository.deleteArchivedPresentation("pres-1");

    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedGetDocs).toHaveBeenCalledTimes(2);
    expect(mockedLimit).toHaveBeenCalledTimes(2);
    expect(mockedLimit.mock.calls).toEqual([[100], [100]]);
    const queryCalls = mockedQuery.mock.calls as unknown as Array<
      Array<unknown>
    >;
    for (let index = 0; index < queryCalls.length; index++) {
      const call = queryCalls[index]!;
      expect(call).toHaveLength(2);
      expect(call[0]).toBe(VERSIONS_COLLECTION_REF);
      expect(call[1]).toBe(mockedLimit.mock.results[index]?.value);
    }
  });
});

describe("published cleanup failures and retry safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedLimit.mockImplementation(((value: number) => ({ limit: value })) as never);
    mockedQuery.mockImplementation(
      ((reference: unknown, queryLimit: unknown) => ({
        reference,
        queryLimit,
      })) as never,
    );
    mockedWriteBatch.mockImplementation(
      (() => ({
        delete: vi.fn(),
        commit: vi.fn(async () => {}),
      })) as never,
    );
  });

  it("rejects a malformed public pointer before any public or draft deletion", async () => {
    configurePublishedDelete({
      pointerData: {
        currentVersionId: 42,
        publishedRevision: 1,
      },
    });

    await expect(
      repository.deleteArchivedPresentation("pres-1"),
    ).rejects.toThrow(/public pointer is malformed/i);

    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it("rejects a pointer currentVersionId mismatch before listing versions or deleting", async () => {
    configurePublishedDelete({
      pointerData: {
        currentVersionId: "version-other",
        publishedRevision: 1,
      },
    });

    await expect(
      repository.deleteArchivedPresentation("pres-1"),
    ).rejects.toThrow(/currentVersionId does not match/i);

    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it("rejects a pointer publishedRevision mismatch before any deletion", async () => {
    configurePublishedDelete({
      pointerData: {
        currentVersionId: "version-current",
        publishedRevision: 5,
      },
    });

    await expect(
      repository.deleteArchivedPresentation("pres-1"),
    ).rejects.toThrow(/publishedRevision does not match/i);

    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it("rejects an empty version query while the pointer exists and preserves draft and pointer", async () => {
    configurePublishedDelete();
    mockGetDocsSequence([Promise.resolve(versionsSnapshot([]))]);

    await expect(
      repository.deleteArchivedPresentation("pres-1"),
    ).rejects.toThrow(/no published versions/i);

    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it("rejects a historical version with a mismatched presentationId and deletes nothing", async () => {
    configurePublishedDelete();
    const foreign = publishedVersionDocument("version-hist-x", "other-presentation");
    mockGetDocsSequence([Promise.resolve(versionsSnapshot([foreign]))]);

    await expect(
      repository.deleteArchivedPresentation("pres-1"),
    ).rejects.toThrow(/belongs to a different presentation/i);

    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it("rejects a version with an empty presentationId safely", async () => {
    configurePublishedDelete();
    const malformed = publishedVersionDocument("version-hist-bad", "");
    mockGetDocsSequence([Promise.resolve(versionsSnapshot([malformed]))]);

    await expect(
      repository.deleteArchivedPresentation("pres-1"),
    ).rejects.toThrow(/invalid presentationId/i);

    expect(mockedWriteBatch).not.toHaveBeenCalled();
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it("preserves retry state when a later version query fails after a successful history batch", async () => {
    configurePublishedDelete();
    const historical = publishedVersionDocument("version-hist-1", "pres-1");
    mockGetDocsSequence([
      Promise.resolve(versionsSnapshot([historical])),
      Promise.reject(new Error("version list failed")),
    ]);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        repository.deleteArchivedPresentation("pres-1"),
      ).rejects.toThrow(/Failed to delete archived presentation/);
    } finally {
      errorSpy.mockRestore();
    }

    const historyBatch = recordedBatch(0);
    expect(historyBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockedWriteBatch).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
    expect(mockedGetDocs).toHaveBeenCalledTimes(2);
  });

  it("does not delete the draft when the final public batch fails", async () => {
    configurePublishedDelete();
    const current = publishedVersionDocument("version-current", "pres-1");
    mockGetDocsSequence([Promise.resolve(versionsSnapshot([current]))]);
    mockedWriteBatch.mockImplementation(
      (() => ({
        delete: vi.fn(),
        commit: vi.fn(async () => {
          throw new Error("final batch failed");
        }),
      })) as never,
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        repository.deleteArchivedPresentation("pres-1"),
      ).rejects.toThrow(/Failed to delete archived presentation/);
    } finally {
      errorSpy.mockRestore();
    }

    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });

  it("deletes the draft only after public cleanup and wraps a draft delete failure", async () => {
    configurePublishedDelete();
    const current = publishedVersionDocument("version-current", "pres-1");
    mockGetDocsSequence([Promise.resolve(versionsSnapshot([current]))]);
    mockedDeleteDoc.mockImplementation(
      (async () => {
        throw new Error("final draft delete failed");
      }) as never,
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        repository.deleteArchivedPresentation("pres-1"),
      ).rejects.toThrow(/Failed to delete archived presentation/);
    } finally {
      errorSpy.mockRestore();
    }

    expect(mockedWriteBatch).toHaveBeenCalledTimes(1);
    expect(recordedBatch(0).commit).toHaveBeenCalledTimes(1);
    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
  });

  it("rejects a pointer whose current version never appears after history cleanup", async () => {
    configurePublishedDelete();
    const historical = publishedVersionDocument("version-hist-1", "pres-1");
    mockGetDocsSequence([
      Promise.resolve(versionsSnapshot([historical])),
      Promise.resolve(versionsSnapshot([])),
    ]);

    await expect(
      repository.deleteArchivedPresentation("pres-1"),
    ).rejects.toThrow(/no published versions/i);

    const historyBatch = recordedBatch(0);
    expect(historyBatch.delete).not.toHaveBeenCalledWith(POINTER_REF);
    expect(mockedDeleteDoc).not.toHaveBeenCalled();
  });
});
