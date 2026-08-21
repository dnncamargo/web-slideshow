import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  increment: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteField: vi.fn(() => "__delete_field__"),
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: vi.fn(() => ({ uid: "user-1", isAnonymous: false })),
}));

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { FirestorePresentationRepository } from "../src/features/persistence/firestore-presentation-repository";
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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "../src/features/persistence/firebase-client";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";

const mockedDeleteField = vi.mocked(deleteField);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedIncrement = vi.mocked(increment);
const mockedQuery = vi.mocked(query);
const mockedServerTimestamp = vi.mocked(serverTimestamp);
const mockedSetDoc = vi.mocked(setDoc);
const mockedUpdateDoc = vi.mocked(updateDoc);
const mockedGetFirestore = vi.mocked(getFirebaseFirestore);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);

const repository = new FirestorePresentationRepository();

function presentationDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    presentation: createBlankPresentation(id),
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
    mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
  });

  it("omits archived documents by default", async () => {
    snapshotWith([
      { id: "a", data: () => presentationDoc("pres-a") },
      {
        id: "b",
        data: () => presentationDoc("pres-b", { archivedAt: "archived", folderId: "folder-1" }),
      },
    ]);

    const summaries = await repository.listPresentations();

    expect(summaries.map((summary) => summary.id)).toEqual(["pres-a"]);
  });

  it("returns active and archived summaries with includeArchived", async () => {
    snapshotWith([
      { id: "a", data: () => presentationDoc("pres-a", { folderId: "folder-1" }) },
      {
        id: "b",
        data: () => presentationDoc("pres-b", { archivedAt: "archived", folderId: "folder-1" }),
      },
    ]);

    const summaries = await repository.listPresentations({ includeArchived: true });

    expect(summaries.map((summary) => summary.id)).toEqual(["pres-a", "pres-b"]);

    const archived = summaries.find((summary) => summary.id === "pres-b");
    expect(archived?.archived).toBe(true);
    expect(archived?.folderId).toBe("folder-1");
  });

  it("reads the collection once regardless of includeArchived", async () => {
    snapshotWith([{ id: "a", data: () => presentationDoc("pres-a") }]);

    await repository.listPresentations({ includeArchived: true });

    expect(mockedGetDocs).toHaveBeenCalledTimes(1);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });
});

describe("archive and restore semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
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
    mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
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

    const payload = mockedUpdateDoc.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
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
    mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
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
    const payload = mockedSetDoc.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty("folderId");
    expect(payload).toMatchObject({ draftRevision: 1 });
  });

  it("stores folderId outside the canonical presentation object", async () => {
    const presentation = createBlankPresentation("pres-1");

    await repository.createPresentation(presentation, { folderId: "folder-1" });

    const payload = mockedSetDoc.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
    expect(payload?.folderId).toBe("folder-1");
    expect(payload?.presentation).not.toHaveProperty("folderId");
    expect(payload?.presentation).toEqual(
      expect.objectContaining({ id: "pres-1" }),
    );
  });
});
