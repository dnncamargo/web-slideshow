import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Presentation } from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  increment: vi.fn((value: number) => `increment(${value})`),
  getFirebaseFirestore: vi.fn(() => ({})),
  getCurrentNonAnonymousUser: vi.fn(() => ({
    uid: "user-1",
    isAnonymous: false,
  })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  deleteDoc: mocks.deleteDoc,
  deleteField: mocks.deleteField,
  orderBy: mocks.orderBy,
  query: mocks.query,
  runTransaction: mocks.runTransaction,
  serverTimestamp: mocks.serverTimestamp,
  increment: mocks.increment,
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: mocks.getFirebaseFirestore,
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: mocks.getCurrentNonAnonymousUser,
}));

import { FirestorePresentationRepository } from "../src/features/persistence/firestore-presentation-repository";
import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import {
  FirestoreOperationError,
  InvalidPersistedPresentationError,
  PresentationRecoveryFailedError,
} from "../src/features/persistence/persistence-errors";

const repository = new FirestorePresentationRepository();

function validPresentation() {
  return createBlankPresentation("pres-1");
}

function validDraft() {
  return {
    presentation: validPresentation(),
    createdAt: "created",
    updatedAt: "updated",
    draftRevision: 3,
    folderId: "folder-1",
    publication: {
      publicationId: "publication-1",
      currentVersionId: "version-9",
      publishedRevision: 3,
      publishedAt: "published",
    },
  };
}

/** A draft whose presentation contains one invalid leaf element. */
function recoverableDraft() {
  const presentation = createBlankPresentation("pres-1");
  presentation.slides = [
    {
      id: "slide-1",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [
        {
          type: "text",
          id: "bad-leaf",
          hidden: false,
          variant: "body",
          // number content is not a valid TextContent
          content: 42,
        } as unknown as Presentation["slides"][number]["elements"][number],
      ],
    },
  ];

  return {
    ...validDraft(),
    presentation,
  };
}

/** A draft whose presentation root structure is invalid. */
function unrecoverableDraft() {
  return {
    presentation: { schemaVersion: 1, slides: [] },
    createdAt: "created",
    updatedAt: "updated",
    draftRevision: 1,
  };
}

function draftSnapshot(data: Record<string, unknown>, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

function setupDirectRead(data: Record<string, unknown>, exists = true) {
  mocks.getDoc.mockImplementation(async () => draftSnapshot(data, exists));
}

function setupTransactionRead(data: Record<string, unknown>, exists = true) {
  const transaction = {
    get: vi.fn(async () => draftSnapshot(data, exists)),
    set: vi.fn(),
    update: vi.fn(),
  };

  mocks.runTransaction.mockImplementation(
    async (
      _firestore: unknown,
      callback: (value: typeof transaction) => unknown,
    ) => callback(transaction),
  );

  return transaction;
}

describe("presentation recovery repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFirebaseFirestore.mockReturnValue({});
    mocks.getCurrentNonAnonymousUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    });
    mocks.doc.mockImplementation((...path: unknown[]) => ({ path: path.slice(1) }));
    mocks.collection.mockImplementation((...path: unknown[]) => ({ path }));
    mocks.serverTimestamp.mockReturnValue("server-ts");
  });

  it("rethrows InvalidPersistedPresentationError unchanged from getPresentation", async () => {
    setupDirectRead({
      presentation: { schemaVersion: 999, slides: [] },
    });

    await expect(repository.getPresentation("pres-1")).rejects.toBeInstanceOf(
      InvalidPersistedPresentationError,
    );
  });

  it("wraps raw Firestore failures into FirestoreOperationError", async () => {
    mocks.getDoc.mockImplementation(async () => {
      throw new Error("network down");
    });

    await expect(repository.getPresentation("pres-1")).rejects.toBeInstanceOf(
      FirestoreOperationError,
    );
  });

  it("inspection performs zero writes", async () => {
    setupDirectRead(recoverableDraft());

    const inspection = await repository.inspectPresentationRecovery("pres-1");

    expect(inspection.status).toBe("recoverable");
    expect(inspection.issues).toHaveLength(1);
    expect(inspection.issues[0]?.path).toEqual([
      "slides",
      0,
      "elements",
      0,
    ]);
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.updateDoc).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("returns a valid current presentation with repaired:false and zero writes", async () => {
    const transaction = setupTransactionRead(validDraft());

    const result = await repository.repairPresentation("pres-1");

    expect(result).toEqual({
      presentation: expect.objectContaining({ id: "pres-1" }),
      repaired: false,
    });
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("throws a dedicated error with zero writes for an unrecoverable draft", async () => {
    const transaction = setupTransactionRead(unrecoverableDraft());

    await expect(repository.repairPresentation("pres-1")).rejects.toBeInstanceOf(
      PresentationRecoveryFailedError,
    );
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("fails without writes when the draft is missing", async () => {
    const transaction = setupTransactionRead({}, false);

    await expect(repository.repairPresentation("pres-1")).rejects.toBeInstanceOf(
      PresentationRecoveryFailedError,
    );
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("repairs a recoverable draft writing the canonical presentation once", async () => {
    const transaction = setupTransactionRead(recoverableDraft());

    const result = await repository.repairPresentation("pres-1");

    expect(result.repaired).toBe(true);
    expect(result.presentation.id).toBe("pres-1");
    // The invalid leaf is gone; the canonical draft is now valid.
    expect(result.presentation.slides[0]?.elements).toEqual([]);

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledTimes(1);
    expect(transaction.set).not.toHaveBeenCalled();

    const [ref, payload] = transaction.update.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(ref).toEqual({
      path: ["users", "user-1", "presentations", "pres-1"],
    });
    expect(payload.presentation).toMatchObject({ id: "pres-1" });
  });

  it("increments draftRevision exactly once on repair", async () => {
    const transaction = setupTransactionRead(recoverableDraft());

    await repository.repairPresentation("pres-1");

    const payload = transaction.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload?.draftRevision).toBe("increment(1)");
    expect(payload?.updatedAt).toBe("server-ts");
  });

  it("preserves metadata and never touches publication pointer or versions on repair", async () => {
    const transaction = setupTransactionRead(recoverableDraft());

    await repository.repairPresentation("pres-1");

    const payload = transaction.update.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;

    // Only the canonical draft fields are written.
    expect(Object.keys(payload ?? {})).toEqual([
      "presentation",
      "updatedAt",
      "draftRevision",
    ]);

    // Publication metadata, createdAt, and folderId are NOT rewritten.
    expect(payload).not.toHaveProperty("publication");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("folderId");

    // No public pointer / immutable version writes.
    expect(transaction.set).not.toHaveBeenCalled();
  });
});