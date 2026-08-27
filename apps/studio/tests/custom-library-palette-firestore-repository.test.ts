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
import { FirestoreCustomLibraryPaletteRepository } from "../src/features/persistence/firestore-custom-library-palette-repository";
import {
  FirestoreOperationError,
  FirebaseAuthenticationError,
  InvalidCustomLibraryPaletteForPersistenceError,
  InvalidPersistedCustomLibraryPaletteError,
} from "../src/features/persistence/persistence-errors";

const mockedCollection = vi.mocked(collection);
const mockedDeleteDoc = vi.mocked(deleteDoc);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedSetDoc = vi.mocked(setDoc);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);

const repository = new FirestoreCustomLibraryPaletteRepository();
const palette = {
  name: "Brand",
  description: "A reusable palette",
  colors: [
    { name: "Text", value: "#ffffff" },
    { name: "Overlay", value: "rgba(10, 20, 30, 0.5)" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
  mockedDoc.mockImplementation((...args) => {
    if (args.length === 1) {
      return { id: "generated-palette-id" } as never;
    }
    return { id: String(args.at(-1)) } as never;
  });
});

describe("FirestoreCustomLibraryPaletteRepository", () => {
  it("requires a current non-anonymous user before Firestore access", async () => {
    mockedGetCurrentUser.mockReturnValue(null);
    await expect(repository.listPalettes()).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    expect(mockedGetDocs).not.toHaveBeenCalled();

    mockedGetCurrentUser.mockReturnValue({ uid: "anonymous", isAnonymous: true } as never);
    await expect(repository.savePalette(palette)).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    expect(mockedSetDoc).not.toHaveBeenCalled();

    await expect(repository.updatePalette("palette-1", palette)).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    expect(mockedGetDoc).not.toHaveBeenCalled();
  });

  it("creates an auto-ID document in the user's palette collection and writes only the validated body", async () => {
    await expect(repository.savePalette(palette)).resolves.toBe("generated-palette-id");

    expect(mockedCollection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "customLibraryPalettes",
    );
    expect(mockedSetDoc).toHaveBeenCalledWith({ id: "generated-palette-id" }, palette);
    expect(mockedSetDoc.mock.calls[0]?.[1]).toEqual({
      name: "Brand",
      description: "A reusable palette",
      colors: [
        { name: "Text", value: "#ffffff" },
        { name: "Overlay", value: "rgba(10, 20, 30, 0.5)" },
      ],
    });
    const serialized = JSON.stringify(mockedSetDoc.mock.calls[0]?.[1]);
    expect(serialized).not.toMatch(/(?:id|paletteId|kind|sourcePresentationId|sourceColorId|colorId)/);
  });

  it("validates before writing and classifies invalid local data", async () => {
    const invalid = { ...palette, colors: [] };

    await expect(repository.savePalette(invalid)).rejects.toBeInstanceOf(
      InvalidCustomLibraryPaletteForPersistenceError,
    );
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("updates the exact existing ID with a complete validated replacement", async () => {
    const updated = {
      name: "Brand 2026",
      colors: [
        { name: "Accent", value: "#facc15" },
        { name: "Accent", value: "#2563eb" },
        { name: "Success", value: "#2563eb" },
      ],
    };
    mockedGetDoc.mockResolvedValue({ exists: () => true } as never);

    await expect(repository.updatePalette("palette-1", updated)).resolves.toBeUndefined();

    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "customLibraryPalettes",
      "palette-1",
    );
    expect(mockedGetDoc).toHaveBeenCalledWith({ id: "palette-1" });
    expect(mockedSetDoc).toHaveBeenCalledWith({ id: "palette-1" }, updated);
    expect(mockedSetDoc.mock.calls[0]?.[1]).toEqual({
      name: "Brand 2026",
      colors: [
        { name: "Accent", value: "#facc15" },
        { name: "Accent", value: "#2563eb" },
        { name: "Success", value: "#2563eb" },
      ],
    });
    expect(mockedSetDoc.mock.calls[0]?.[1]).not.toHaveProperty("description");
  });

  it.each([
    ["name", { ...palette, name: " Brand " }],
    ["color name", { ...palette, colors: [{ name: " Text ", value: "#facc15" }] }],
    ["color literal", { ...palette, colors: [{ name: "Accent", value: "not-a-color" }] }],
    ["zero colors", { ...palette, colors: [] }],
  ])("rejects invalid %s before update reads or writes", async (_kind, invalid) => {
    await expect(repository.updatePalette("palette-1", invalid)).rejects.toBeInstanceOf(
      InvalidCustomLibraryPaletteForPersistenceError,
    );
    expect(mockedGetDoc).not.toHaveBeenCalled();
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("rejects an update for a missing target without creating a document", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);

    const error = await repository.updatePalette("missing", palette).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FirestoreOperationError);
    expect(error).toHaveProperty("message", 'Failed to update Custom Library palette "missing": palette does not exist.');
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("lists validated records with document IDs outside the persisted body", async () => {
    mockedGetDocs.mockResolvedValue({
      docs: [
        { id: "first", data: () => palette },
        { id: "second", data: () => ({ ...palette, name: "Second" }) },
      ],
    } as never);

    await expect(repository.listPalettes()).resolves.toEqual([
      { id: "first", palette },
      { id: "second", palette: { ...palette, name: "Second" } },
    ]);
    expect(mockedCollection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "customLibraryPalettes",
    );
  });

  it("fails explicitly on malformed persisted list data and identifies its document", async () => {
    mockedGetDocs.mockResolvedValue({
      docs: [{ id: "malformed-palette", data: () => ({ name: "Bad", colors: [] }) }],
    } as never);

    const error = await repository.listPalettes().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(InvalidPersistedCustomLibraryPaletteError);
    expect(error).toHaveProperty("message", 'Persisted Custom Library palette "malformed-palette" is invalid.');
  });

  it("gets valid records, returns null for missing documents, and rejects malformed records", async () => {
    mockedGetDoc.mockResolvedValueOnce({
      id: "palette-1",
      exists: () => true,
      data: () => palette,
    } as never);
    await expect(repository.getPalette("palette-1")).resolves.toEqual({ id: "palette-1", palette });

    mockedGetDoc.mockResolvedValueOnce({ exists: () => false } as never);
    await expect(repository.getPalette("missing")).resolves.toBeNull();

    mockedGetDoc.mockResolvedValueOnce({
      id: "bad-palette",
      exists: () => true,
      data: () => ({ ...palette, extra: true }),
    } as never);
    await expect(repository.getPalette("bad-palette")).rejects.toBeInstanceOf(
      InvalidPersistedCustomLibraryPaletteError,
    );
  });

  it("deletes only the current user's palette document", async () => {
    await repository.deletePalette("palette-1");

    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "customLibraryPalettes",
      "palette-1",
    );
    expect(mockedDeleteDoc).toHaveBeenCalledWith({ id: "palette-1" });
  });

  it.each([
    ["save", () => repository.savePalette(palette), mockedSetDoc],
    ["update lookup", () => repository.updatePalette("palette-1", palette), mockedGetDoc],
    ["get", () => repository.getPalette("palette-1"), mockedGetDoc],
    ["list", () => repository.listPalettes(), mockedGetDocs],
    ["delete", () => repository.deletePalette("palette-1"), mockedDeleteDoc],
  ] as const)("translates %s Firestore failures", async (_operation, action, mock) => {
    const cause = new Error("Firestore unavailable");
    mock.mockRejectedValue(cause);

    const error = await action().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FirestoreOperationError);
    expect((error as FirestoreOperationError).cause).toBe(cause);
  });

  it("translates update writes and preserves the raw Firestore cause", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => true } as never);
    const cause = new Error("Firestore unavailable");
    mockedSetDoc.mockRejectedValue(cause);

    const error = await repository.updatePalette("palette-1", palette).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FirestoreOperationError);
    expect((error as FirestoreOperationError).cause).toBe(cause);
    expect(error).toHaveProperty("message", 'Failed to update Custom Library palette "palette-1".');
  });
});
