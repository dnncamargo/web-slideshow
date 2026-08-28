import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: vi.fn(() => ({ uid: "user-1", isAnonymous: false })),
}));

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";
import { createCustomLibraryItemDraft } from "../src/features/custom-library/custom-library-item";
import { FirestoreCustomLibraryRepository } from "../src/features/persistence/firestore-custom-library-repository";
import {
  FirestoreOperationError,
  FirebaseAuthenticationError,
  InvalidCustomLibraryItemForPersistenceError,
  InvalidPersistedCustomLibraryItemError,
} from "../src/features/persistence/persistence-errors";

const mockedCollection = vi.mocked(collection);
const mockedDeleteDoc = vi.mocked(deleteDoc);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedSetDoc = vi.mocked(setDoc);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);

const repository = new FirestoreCustomLibraryRepository();
const item = {
  name: "Widget",
  description: "A reusable widget",
  root: { type: "text" as const, properties: [{ path: "variant", value: "title" }] },
};
const itemWithDependency = {
  name: "Fira title",
  root: { type: "text" as const, properties: [{ path: "typography.fontFamily", value: "Fira Code" }] },
  dependencies: {
    fonts: [{
      family: "Fira Code",
      faces: [{ weight: 400, style: "normal" as const, source: { type: "url" as const, url: "https://example.com/fira.woff2", format: "woff2" as const } }],
    }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
  mockedDoc.mockImplementation((...args) => {
    if (args.length === 1) {
      return { id: "generated-id" } as never;
    }
    return { id: String(args.at(-1)) } as never;
  });
});

describe("FirestoreCustomLibraryRepository", () => {
  it("requires a current authenticated user and rejects anonymous users", async () => {
    mockedGetCurrentUser.mockReturnValue(null);
    await expect(repository.listItems()).rejects.toBeInstanceOf(FirebaseAuthenticationError);

    mockedGetCurrentUser.mockReturnValue({ uid: "anonymous", isAnonymous: true } as never);
    await expect(repository.saveItem(item)).rejects.toBeInstanceOf(FirebaseAuthenticationError);
  });

  it("creates an auto-ID document in the current user's collection and writes the exact item body", async () => {
    const id = await repository.saveItem(item);

    expect(id).toBe("generated-id");
    expect(mockedCollection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "customLibraryItems",
    );
    expect(mockedSetDoc).toHaveBeenCalledWith({ id: "generated-id" }, item);
    expect(mockedSetDoc.mock.calls[0]?.[1]).toEqual({
      name: "Widget",
      description: "A reusable widget",
      root: item.root,
    });
    expect(mockedSetDoc.mock.calls[0]?.[1]).not.toHaveProperty("id");
    expect(mockedSetDoc.mock.calls[0]?.[1]).not.toHaveProperty("createdAt");
    expect(mockedSetDoc.mock.calls[0]?.[1]).not.toHaveProperty("userId");
  });

  it("persists a Style Font dependency snapshot exactly without identity or provenance fields", async () => {
    await repository.saveItem(itemWithDependency);

    expect(mockedSetDoc.mock.calls[0]?.[1]).toEqual(itemWithDependency);
    expect(mockedSetDoc.mock.calls[0]?.[1]).not.toHaveProperty("dependencies.fonts[0].id");
    expect(JSON.stringify(mockedSetDoc.mock.calls[0]?.[1])).not.toMatch(/sourcePresentationId|fontMasterId|provenance/);
  });

  it("validates before writing and classifies invalid local data", async () => {
    const invalid = { ...item, root: { type: "text", properties: [{ path: "id", value: "bad" }] } };

    await expect(repository.saveItem(invalid as never)).rejects.toBeInstanceOf(
      InvalidCustomLibraryItemForPersistenceError,
    );
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("integrates draft creation with the exact validated persisted body", async () => {
    const draft = createCustomLibraryItemDraft({
      name: "  Widget ",
      description: "  Description ",
      root: {
        type: "text",
        id: "source-id",
        hidden: false,
        content: "Title",
        variant: "title",
      },
      selections: new Map([["source-id", new Set(["variant"])]]),
    });

    await repository.saveItem(draft);
    expect(mockedSetDoc.mock.calls[0]?.[1]).toEqual({
      name: "Widget",
      description: "Description",
      root: { type: "text", properties: [{ path: "variant", value: "title" }] },
    });
  });

  it("gets a missing item as null", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);
    await expect(repository.getItem("missing")).resolves.toBeNull();
  });

  it("returns the Firestore ID separately from a validated item", async () => {
    mockedGetDoc.mockResolvedValue({
      id: "item-1",
      exists: () => true,
      data: () => item,
    } as never);

    await expect(repository.getItem("item-1")).resolves.toEqual({ id: "item-1", item });
  });

  it("loads dependency snapshots through get and list parsing, while retaining legacy records", async () => {
    mockedGetDoc.mockResolvedValue({ id: "font-item", exists: () => true, data: () => itemWithDependency } as never);
    await expect(repository.getItem("font-item")).resolves.toEqual({ id: "font-item", item: itemWithDependency });

    mockedGetDocs.mockResolvedValue({
      docs: [
        { id: "font-item", data: () => itemWithDependency },
        { id: "legacy-item", data: () => item },
      ],
    } as never);
    await expect(repository.listItems()).resolves.toEqual([
      { id: "font-item", item: itemWithDependency },
      { id: "legacy-item", item },
    ]);
  });

  it("rejects malformed persisted get data", async () => {
    mockedGetDoc.mockResolvedValue({
      id: "bad",
      exists: () => true,
      data: () => ({ ...item, id: "unexpected" }),
    } as never);
    await expect(repository.getItem("bad")).rejects.toBeInstanceOf(
      InvalidPersistedCustomLibraryItemError,
    );
  });

  it("validates every listed document and preserves snapshot order", async () => {
    mockedGetDocs.mockResolvedValue({
      docs: [
        { id: "first", data: () => item },
        { id: "second", data: () => ({ ...item, name: "Second" }) },
      ],
    } as never);

    await expect(repository.listItems()).resolves.toEqual([
      { id: "first", item },
      { id: "second", item: { ...item, name: "Second" } },
    ]);
  });

  it("fails instead of skipping malformed listed documents", async () => {
    mockedGetDocs.mockResolvedValue({
      docs: [{ id: "bad", data: () => ({ name: "Bad" }) }],
    } as never);
    await expect(repository.listItems()).rejects.toBeInstanceOf(
      InvalidPersistedCustomLibraryItemError,
    );
  });

  it("deletes only the current user's item document", async () => {
    await repository.deleteItem("item-1");
    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "customLibraryItems",
      "item-1",
    );
    expect(mockedDeleteDoc).toHaveBeenCalledWith({ id: "item-1" });
  });

  it.each([
    ["save", () => repository.saveItem(item), mockedSetDoc],
    ["get", () => repository.getItem("item-1"), mockedGetDoc],
    ["list", () => repository.listItems(), mockedGetDocs],
    ["delete", () => repository.deleteItem("item-1"), mockedDeleteDoc],
  ] as const)("wraps %s Firestore failures and preserves the cause", async (_operation, action, mock) => {
    const cause = new Error("Firestore unavailable");
    mock.mockRejectedValue(cause);

    const error = await action().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FirestoreOperationError);
    expect((error as FirestoreOperationError).cause).toBe(cause);
  });
});
