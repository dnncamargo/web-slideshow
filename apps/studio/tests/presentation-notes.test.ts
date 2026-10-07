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
  appendPointedNote,
  applySlideNotes,
  createEmptyNotes,
  getPointedNoteIds,
  getNoteForSlide,
  makeFirestoreSafeNotes,
  normalizePersistedNotes,
  removePointedNote,
  updatePointedNoteText,
  updateSlideNoteText,
  type SlideNotes,
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

const pointed = (overrides: Partial<SlideNotes["pointed"][number]> = {}) => ({
  id: "pointed-note-1",
  text: "Comment",
  x: 240,
  y: 150,
  ...overrides,
});

describe("presentation notes domain helpers", () => {
  it("normalizes legacy strings to complete SlideNotes", () => {
    expect(
      normalizePersistedNotes({ bySlideId: { "slide-1": "hello" } }),
    ).toEqual({
      bySlideId: {
        "slide-1": { text: "hello", pointed: [] },
      },
    });
  });

  it("serializes ordinary-only normalized state as a legacy string", () => {
    const notes = normalizePersistedNotes({
      bySlideId: { "slide-1": "keep  exact text  " },
    });

    expect(makeFirestoreSafeNotes(notes)).toEqual({
      bySlideId: { "slide-1": "keep  exact text  " },
    });
  });

  it("round-trips rich state, including empty ordinary text", () => {
    const persisted = {
      bySlideId: {
        "slide-1": {
          text: "ordinary",
          pointed: [pointed()],
        },
        "slide-2": {
          pointed: [pointed({ id: "empty-text", text: "" })],
        },
      },
    };

    const normalized = normalizePersistedNotes(persisted);

    expect(normalized).toEqual({
      bySlideId: {
        "slide-1": { text: "ordinary", pointed: [pointed()] },
        "slide-2": {
          text: "",
          pointed: [pointed({ id: "empty-text", text: "" })],
        },
      },
    });
    expect(normalizePersistedNotes(makeFirestoreSafeNotes(normalized))).toEqual(
      normalized,
    );
    expect(makeFirestoreSafeNotes(normalized)).toEqual({
      bySlideId: {
        "slide-1": { text: "ordinary", pointed: [pointed()] },
        "slide-2": { pointed: [pointed({ id: "empty-text", text: "" })] },
      },
    });
  });

  it("drops malformed pointed entries while preserving valid entries and order", () => {
    const notes = normalizePersistedNotes({
      bySlideId: {
        "slide-1": {
          pointed: [
            pointed({ id: "first" }),
            { id: "bad-coordinate", text: "x", x: -1, y: 2 },
            { id: "bad-number", text: "x", x: Number.NaN, y: 2 },
            { id: "bad-text", text: 42, x: 1, y: 2 },
            pointed({ id: "first", text: "duplicate" }),
            pointed({ id: "second", text: "second" }),
          ],
        },
      },
    });

    expect(notes.bySlideId["slide-1"]).toEqual({
      text: "",
      pointed: [
        pointed({ id: "first" }),
        pointed({ id: "second", text: "second" }),
      ],
    });
  });

  it("turns malformed text into empty text while keeping valid pointed notes", () => {
    expect(
      normalizePersistedNotes({
        bySlideId: {
          "slide-1": { text: 42, pointed: [pointed()] },
        },
      }),
    ).toEqual({
      bySlideId: { "slide-1": { text: "", pointed: [pointed()] } },
    });
  });

  it("omits empty slide state and malformed whole documents", () => {
    expect(
      normalizePersistedNotes({
        bySlideId: {
          "slide-empty": { text: "", pointed: [] },
          "slide-invalid": 42,
        },
      }),
    ).toEqual(createEmptyNotes());
    expect(normalizePersistedNotes(undefined)).toEqual(createEmptyNotes());
    expect(normalizePersistedNotes({ bySlideId: 42 })).toEqual(
      createEmptyNotes(),
    );
  });

  it("updates ordinary text without losing pointed entries", () => {
    const notes = normalizePersistedNotes({
      bySlideId: { "slide-1": { pointed: [pointed()] } },
    });

    const updated = updateSlideNoteText(notes, "slide-1", "new text");

    expect(updated.bySlideId["slide-1"]).toEqual({
      text: "new text",
      pointed: [pointed()],
    });
    expect(getNoteForSlide(updated, "slide-1")).toBe("new text");
  });

  it("appends pointed notes without losing ordinary text or existing entries", () => {
    const notes = normalizePersistedNotes({
      bySlideId: {
        "slide-1": {
          text: "ordinary",
          pointed: [pointed({ id: "first", x: 10, y: 20 })],
        },
      },
    });

    const updated = appendPointedNote(
      notes,
      "slide-1",
      pointed({ id: "second", text: "new", x: 30, y: 40 }),
    );

    expect(updated.bySlideId["slide-1"]).toEqual({
      text: "ordinary",
      pointed: [
        pointed({ id: "first", x: 10, y: 20 }),
        pointed({ id: "second", text: "new", x: 30, y: 40 }),
      ],
    });
  });

  it("updates pointed text by id while preserving identity, position, and order", () => {
    const notes = normalizePersistedNotes({
      bySlideId: {
        "slide-1": {
          text: "ordinary",
          pointed: [
            pointed({ id: "first", x: 10, y: 20 }),
            pointed({ id: "second", x: 30, y: 40 }),
          ],
        },
      },
    });

    const updated = updatePointedNoteText(notes, "slide-1", "second", "edited");

    expect(updated.bySlideId["slide-1"]).toEqual({
      text: "ordinary",
      pointed: [
        pointed({ id: "first", x: 10, y: 20 }),
        pointed({ id: "second", text: "edited", x: 30, y: 40 }),
      ],
    });
  });

  it("removes only the matching pointed id and keeps survivor order", () => {
    const notes = normalizePersistedNotes({
      bySlideId: {
        "slide-1": {
          text: "ordinary",
          pointed: [
            pointed({ id: "first" }),
            pointed({ id: "second" }),
            pointed({ id: "third" }),
          ],
        },
      },
    });

    const updated = removePointedNote(notes, "slide-1", "second");

    expect(updated.bySlideId["slide-1"]).toEqual({
      text: "ordinary",
      pointed: [pointed({ id: "first" }), pointed({ id: "third" })],
    });
    expect(makeFirestoreSafeNotes(updated)).not.toHaveProperty(
      "bySlideId.slide-1.pointed.0.number",
    );
  });

  it("collects pointed ids across slides for deterministic authoring allocation", () => {
    const notes = normalizePersistedNotes({
      bySlideId: {
        "slide-1": { pointed: [pointed({ id: "pointed-note" })] },
        "slide-2": { pointed: [pointed({ id: "pointed-note-2" })] },
      },
    });

    expect(getPointedNoteIds(notes)).toEqual(
      new Set(["pointed-note", "pointed-note-2"]),
    );
  });

  it("replaces or clears one complete slide without touching other slides", () => {
    const notes = normalizePersistedNotes({
      bySlideId: {
        "slide-1": "first",
        "slide-2": { pointed: [pointed()] },
      },
    });

    const replaced = applySlideNotes(notes, "slide-1", {
      text: "updated",
      pointed: [pointed({ id: "new-id" })],
    });
    const cleared = applySlideNotes(replaced, "slide-1", {
      text: "",
      pointed: [],
    });

    expect(cleared.bySlideId).toEqual({
      "slide-2": { text: "", pointed: [pointed()] },
    });
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

  it("loads a missing notes document as empty notes on the owner path", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);

    await expect(repository.getNotes("pres-1")).resolves.toEqual(
      createEmptyNotes(),
    );
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

  it("reads the current document in a transaction and preserves unrelated rich slides", async () => {
    const transactionGet = vi.fn(async () => ({
      exists: () => true,
      data: () => ({
        bySlideId: {
          "slide-1": "old",
          "slide-2": { pointed: [pointed()] },
        },
      }),
    }));
    const transactionSet = vi.fn();

    mockedRunTransaction.mockImplementation(async (_, updateFn) =>
      updateFn({ get: transactionGet, set: transactionSet } as never),
    );

    await repository.setSlideNotes("pres-1", "slide-1", {
      text: "updated",
      pointed: [],
    });

    expect(transactionGet).toHaveBeenCalledWith({ id: "notes" });
    expect(transactionSet).toHaveBeenCalledWith(
      { id: "notes" },
      {
        bySlideId: {
          "slide-1": "updated",
          "slide-2": { pointed: [pointed()] },
        },
      },
    );
  });

  it("clears one slide while preserving other slides", async () => {
    const transactionSet = vi.fn();
    mockedRunTransaction.mockImplementation(async (_, updateFn) =>
      updateFn({
        get: async () => ({
          exists: () => true,
          data: () => ({
            bySlideId: { "slide-1": "clear me", "slide-2": "keep me" },
          }),
        }),
        set: transactionSet,
      } as never),
    );

    await repository.setSlideNotes("pres-1", "slide-1", {
      text: "",
      pointed: [],
    });

    expect(transactionSet).toHaveBeenCalledWith(
      { id: "notes" },
      { bySlideId: { "slide-2": "keep me" } },
    );
  });

  it("rejects writes without an authenticated non-anonymous owner", async () => {
    mockedGetCurrentUser.mockReturnValue(null as never);

    await expect(
      repository.setSlideNotes("pres-1", "slide-1", {
        text: "note",
        pointed: [],
      }),
    ).rejects.toThrow(/Unauthenticated/);
    expect(mockedRunTransaction).not.toHaveBeenCalled();
  });
});
