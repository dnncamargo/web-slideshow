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

import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";
import { FirestoreCustomLibraryFileRepository } from "../src/features/persistence/firestore-custom-library-file-repository";
import {
  FirebaseAuthenticationError,
  FirestoreOperationError,
  InvalidCustomLibraryFileForPersistenceError,
  InvalidPersistedCustomLibraryFileError,
} from "../src/features/persistence/persistence-errors";

const mockedCollection = vi.mocked(collection);
const mockedDeleteDoc = vi.mocked(deleteDoc);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedSetDoc = vi.mocked(setDoc);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);
const repository = new FirestoreCustomLibraryFileRepository();

const file = {
  name: "Workshop audio",
  kind: "audio" as const,
  representation: "binary" as const,
  source: {
    assetId: "123e4567-e89b-12d3-a456-426614174000",
    storagePath: "users/user-1/assets/123e4567-e89b-12d3-a456-426614174000",
    downloadUrl: "https://blob.vercel-storage.test/workshop.mp3",
    contentType: "audio/mpeg" as const,
    sizeBytes: 42,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
  mockedDoc.mockImplementation((...args) => args.length === 1
    ? ({ id: "generated-file-id" } as never)
    : ({ id: String(args.at(-1)) } as never));
});

describe("FirestoreCustomLibraryFileRepository", () => {
  it("requires a current non-anonymous user", async () => {
    mockedGetCurrentUser.mockReturnValue(null);
    await expect(repository.listFiles()).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    expect(mockedGetDocs).not.toHaveBeenCalled();

    mockedGetCurrentUser.mockReturnValue({ uid: "anonymous", isAnonymous: true } as never);
    await expect(repository.saveFile(file)).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("saves the validated body in the owner-scoped file collection", async () => {
    await expect(repository.saveFile(file)).resolves.toBe("generated-file-id");
    expect(mockedCollection).toHaveBeenCalledWith(expect.anything(), "users", "user-1", "customLibraryFiles");
    expect(mockedSetDoc).toHaveBeenCalledWith({ id: "generated-file-id" }, file);
  });

  it("rejects invalid data before Firestore access", async () => {
    await expect(repository.saveFile({ ...file, name: " renamed " })).rejects.toBeInstanceOf(InvalidCustomLibraryFileForPersistenceError);
    expect(mockedSetDoc).not.toHaveBeenCalled();
    await expect(repository.updateFile("file-1", { ...file, source: { ...file.source, sizeBytes: -1 } })).rejects.toBeInstanceOf(InvalidCustomLibraryFileForPersistenceError);
    expect(mockedGetDoc).not.toHaveBeenCalled();
  });

  it("lists and gets validated records", async () => {
    mockedGetDocs.mockResolvedValue({ docs: [{ id: "first", data: () => file }] } as never);
    await expect(repository.listFiles()).resolves.toEqual([{ id: "first", file }]);
    mockedGetDoc.mockResolvedValueOnce({ id: "first", exists: () => true, data: () => file } as never);
    await expect(repository.getFile("first")).resolves.toEqual({ id: "first", file });
    mockedGetDoc.mockResolvedValueOnce({ exists: () => false } as never);
    await expect(repository.getFile("missing")).resolves.toBeNull();
  });

  it("rejects malformed persisted data", async () => {
    mockedGetDocs.mockResolvedValue({ docs: [{ id: "bad", data: () => ({ ...file, extra: true }) }] } as never);
    await expect(repository.listFiles()).rejects.toBeInstanceOf(InvalidPersistedCustomLibraryFileError);
  });

  it("updates the same Firestore document ID while preserving managed asset identity", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => true } as never);
    const renamed = { ...file, name: "Renamed audio" };
    await expect(repository.updateFile("file-1", renamed)).resolves.toBeUndefined();
    expect(mockedDoc).toHaveBeenCalledWith(expect.anything(), "users", "user-1", "customLibraryFiles", "file-1");
    expect(mockedSetDoc).toHaveBeenCalledWith({ id: "file-1" }, renamed);
    expect((mockedSetDoc.mock.calls[0]?.[1] as typeof file).source).toEqual(file.source);
  });

  it("rejects an update for a missing document", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);
    await expect(repository.updateFile("missing", file)).rejects.toMatchObject({ message: expect.stringContaining("does not exist") });
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("deletes only the Firestore metadata document", async () => {
    await repository.deleteFile("file-1");
    expect(mockedDoc).toHaveBeenCalledWith(expect.anything(), "users", "user-1", "customLibraryFiles", "file-1");
    expect(mockedDeleteDoc).toHaveBeenCalledWith({ id: "file-1" });
  });

  it.each([
    ["save", () => repository.saveFile(file), mockedSetDoc],
    ["update lookup", () => repository.updateFile("file-1", file), mockedGetDoc],
    ["get", () => repository.getFile("file-1"), mockedGetDoc],
    ["list", () => repository.listFiles(), mockedGetDocs],
    ["delete", () => repository.deleteFile("file-1"), mockedDeleteDoc],
  ] as const)("translates %s Firestore failures", async (_name, action, mock) => {
    const cause = new Error("Firestore unavailable");
    mock.mockRejectedValue(cause);
    const error = await action().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FirestoreOperationError);
    expect((error as FirestoreOperationError).cause).toBe(cause);
  });
});
