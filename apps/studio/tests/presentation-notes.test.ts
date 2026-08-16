import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  runTransaction: vi.fn(),
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

import {
  applySlideNote,
  createEmptyNotes,
  makeFirestoreSafeNotes,
  normalizePersistedNotes,
} from "../src/features/persistence/presentation-notes";
import { FirestorePresentationNotesRepository } from "../src/features/persistence/firestore-presentation-notes-repository";

import { doc, getDoc, runTransaction } from "firebase/firestore";
import { getFirebaseFirestore } from "../src/features/persistence/firebase-client";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";

const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedRunTransaction = vi.mocked(runTransaction);
const mockedGetFirestore = vi.mocked(getFirebaseFirestore);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);

const repository = new FirestorePresentationNotesRepository();

describe("presentation notes domain helpers", () => {
  it("returns empty notes for missing/malformed persisted data", () => {
    expect(normalizePersistedNotes(undefined)).toEqual(createEmptyNotes());
    expect(normalizePersistedNotes(null)).toEqual(createEmptyNotes());
    expect(normalizePersistedNotes("nope")).toEqual(createEmptyNotes());
    expect(normalizePersistedNotes([])).toEqual(createEmptyNotes());
    expect(normalizePersistedNotes({ bySlideId: 42 })).toEqual(
      createEmptyNotes(),
    );
  });

  it("preserves non-empty notes and omits empty/non-string entries on parse", () => {
    const notes = normalizePersistedNotes({
      bySlideId: {
        "slide-1": "hello",
        "slide-2": "",
        "slide-3": 42,
      },
    });

    expect(notes.bySlideId).toEqual({ "slide-1": "hello" });
  });

  it("round-trips non-empty notes exactly through serialization", () => {
    const notes = createEmptyNotes();
    const withNote = applySlideNote(notes, "slide-1", "keep  exact text  ");

    const safe = makeFirestoreSafeNotes(withNote) as {
      bySlideId: Record<string, string>;
    };
    const reparsed = normalizePersistedNotes(safe);

    expect(safe.bySlideId).toEqual({ "slide-1": "keep  exact text  " });
    expect(reparsed.bySlideId).toEqual({ "slide-1": "keep  exact text  " });
  });

  it("omits empty note text from serialization", () => {
    const notes = applySlideNote(
      applySlideNote(createEmptyNotes(), "slide-1", "note"),
      "slide-1",
      "",
    );

    const safe = makeFirestoreSafeNotes(notes) as {
      bySlideId: Record<string, string>;
    };

    expect(safe.bySlideId).toEqual({});
  });

  it("applying an empty note removes only that slideId", () => {
    const notes = applySlideNote(
      applySlideNote(createEmptyNotes(), "slide-1", "a"),
      "slide-2",
      "b",
    );
    const cleared = applySlideNote(notes, "slide-1", "");

    expect(cleared.bySlideId).toEqual({ "slide-2": "b" });
  });
});

describe("presentation notes repository wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    } as never);
    mockedDoc.mockReturnValue({ id: "notes" } as never);
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({}),
    } as never);
  });

  it("loads a missing notes document as empty notes", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);

    const notes = await repository.getNotes("pres-1");

    expect(notes).toEqual(createEmptyNotes());
    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentations",
      "pres-1",
      "private",
      "notes",
    );
  });

  it("loads malformed notes data as empty notes", async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ bySlideId: { "slide-1": 123 } }),
    } as never);

    const notes = await repository.getNotes("pres-1");

    expect(notes).toEqual(createEmptyNotes());
  });

  it("writes notes only to the private notes document path", async () => {
    const transactionSet = vi.fn();

    mockedRunTransaction.mockImplementation(async (_, updateFn) =>
      updateFn({
        get: async () => ({ exists: () => false }),
        set: transactionSet,
      } as never),
    );

    await repository.setSlideNote("pres-1", "slide-1", "note text");

    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentations",
      "pres-1",
      "private",
      "notes",
    );

    expect(transactionSet).toHaveBeenCalledWith(
      { id: "notes" },
      {
        bySlideId: {
          "slide-1": "note text",
        },
      },
    );
  });

  it("rejects notes write when no authenticated non-anonymous user exists", async () => {
    mockedGetCurrentUser.mockReturnValue(null as never);

    await expect(
      repository.setSlideNote("pres-1", "slide-1", "note"),
    ).rejects.toThrow(/Unauthenticated/);
    expect(mockedRunTransaction).not.toHaveBeenCalled();
  });

  it("loads valid notes preserving text exactly", async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        bySlideId: {
          "slide-1": "  keep exact text  ",
          "slide-2": "second note",
        },
      }),
    } as never);

    const notes = await repository.getNotes("pres-1");

    expect(notes).toEqual({
      bySlideId: {
        "slide-1": "  keep exact text  ",
        "slide-2": "second note",
      },
    });
  });
});
