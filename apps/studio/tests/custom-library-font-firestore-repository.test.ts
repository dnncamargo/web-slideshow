import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(), deleteDoc: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), runTransaction: vi.fn(), setDoc: vi.fn(),
}));
vi.mock("../src/features/persistence/firebase-client", () => ({ getFirebaseFirestore: vi.fn(() => ({})) }));
vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: vi.fn(() => ({ uid: "user-1", isAnonymous: false })),
}));

import { collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc } from "firebase/firestore";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";
import { FirestoreCustomLibraryFontRepository } from "../src/features/persistence/firestore-custom-library-font-repository";
import {
  FirebaseAuthenticationError,
  FirestoreOperationError,
  InvalidCustomLibraryFontForPersistenceError,
  InvalidPersistedCustomLibraryFontError,
} from "../src/features/persistence/persistence-errors";

const mockedCollection = vi.mocked(collection);
const mockedDeleteDoc = vi.mocked(deleteDoc);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedRunTransaction = vi.mocked(runTransaction);
const mockedSetDoc = vi.mocked(setDoc);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);
const repository = new FirestoreCustomLibraryFontRepository();
const font = { family: "Inter", faces: [{ weight: 400, style: "normal" as const, source: {
  type: "url" as const, url: "https://cdn.example.test/font.woff2", format: "woff2" as const,
} }] };

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
  mockedDoc.mockImplementation((...args) => args.length === 1
    ? { id: "generated-font-id" } as never
    : { id: String(args.at(-1)) } as never);
});

describe("FirestoreCustomLibraryFontRepository", () => {
  it("writes the exact validated body to the user's custom font collection and returns its ID", async () => {
    await expect(repository.saveFont(font)).resolves.toBe("generated-font-id");
    expect(mockedCollection).toHaveBeenCalledWith(expect.anything(), "users", "user-1", "customLibraryFonts");
    expect(mockedSetDoc).toHaveBeenCalledWith({ id: "generated-font-id" }, font);
    expect(JSON.stringify(mockedSetDoc.mock.calls[0]?.[1])).not.toMatch(/provider|provenance|fontId|id/);
  });

  it("recognizes an equivalent new family after a lost commit response", async () => {
    const documentId = "123e4567-e89b-12d3-a456-426614174000";
    const persisted = new Map<string, typeof font>();
    let firstAttempt = true;
    mockedRunTransaction.mockImplementation(async (_db, callback) => {
      const transaction = {
        get: vi.fn(async (reference: { id: string }) => ({
          exists: () => persisted.has(reference.id),
          data: () => persisted.get(reference.id),
        })),
        set: vi.fn((reference: { id: string }, value: typeof font) => {
          persisted.set(reference.id, value);
        }),
      };
      await callback(transaction as never);
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error("commit succeeded but response was lost");
      }
    });

    await expect(repository.saveFont(font, { documentId })).rejects.toBeInstanceOf(FirestoreOperationError);
    await expect(repository.saveFont(font, { documentId })).resolves.toBe(documentId);
    await expect(repository.saveFont(font, { documentId })).resolves.toBe(documentId);
    expect(persisted.size).toBe(1);
    expect([...persisted.keys()]).toEqual([documentId]);
  });

  it("does not overwrite conflicting data at a stable family identity", async () => {
    const documentId = "123e4567-e89b-12d3-a456-426614174000";
    const conflictingFont = { ...font, family: "Different Family" };
    mockedRunTransaction.mockImplementation(async (_db, callback) => {
      await callback({
        get: vi.fn(async () => ({ exists: () => true, data: () => conflictingFont })),
        set: vi.fn(),
      } as never);
    });

    await expect(repository.saveFont(font, { documentId })).rejects.toMatchObject({
      message: expect.stringContaining("conflicts"),
    });
  });

  it("rejects invalid drafts before writes", async () => {
    await expect(repository.saveFont({ ...font, family: " Inter " })).rejects.toBeInstanceOf(InvalidCustomLibraryFontForPersistenceError);
    expect(mockedSetDoc).not.toHaveBeenCalled();
    await expect(repository.updateFont("font-1", { ...font, faces: [] })).rejects.toBeInstanceOf(InvalidCustomLibraryFontForPersistenceError);
    expect(mockedGetDoc).not.toHaveBeenCalled();
  });

  it("lists and gets parsed records, including missing get results", async () => {
    mockedGetDocs.mockResolvedValue({ docs: [{ id: "first", data: () => font }] } as never);
    await expect(repository.listFonts()).resolves.toEqual([{ id: "first", font }]);
    mockedGetDoc.mockResolvedValueOnce({ id: "first", exists: () => true, data: () => font } as never);
    await expect(repository.getFont("first")).resolves.toEqual({ id: "first", font });
    mockedGetDoc.mockResolvedValueOnce({ exists: () => false } as never);
    await expect(repository.getFont("missing")).resolves.toBeNull();
  });

  it("rejects invalid persisted documents", async () => {
    mockedGetDocs.mockResolvedValue({ docs: [{ id: "bad", data: () => ({ family: "Bad", faces: [] }) }] } as never);
    await expect(repository.listFonts()).rejects.toBeInstanceOf(InvalidPersistedCustomLibraryFontError);
  });

  it("updates by complete replacement and safely rejects missing targets", async () => {
    mockedGetDoc.mockResolvedValueOnce({ exists: () => true } as never);
    await expect(repository.updateFont("font-1", font)).resolves.toBeUndefined();
    expect(mockedSetDoc).toHaveBeenCalledWith({ id: "font-1" }, font);
    mockedGetDoc.mockResolvedValueOnce({ exists: () => false } as never);
    await expect(repository.updateFont("missing", font)).rejects.toMatchObject({ message: expect.stringContaining("does not exist") });
    expect(mockedSetDoc).toHaveBeenCalledTimes(1);
  });

  it("deletes the exact user document", async () => {
    await repository.deleteFont("font-1");
    expect(mockedDoc).toHaveBeenCalledWith(expect.anything(), "users", "user-1", "customLibraryFonts", "font-1");
    expect(mockedDeleteDoc).toHaveBeenCalledWith({ id: "font-1" });
  });

  it("rejects unauthenticated and anonymous users through the existing boundary", async () => {
    mockedGetCurrentUser.mockReturnValue(null);
    await expect(repository.listFonts()).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    mockedGetCurrentUser.mockReturnValue({ uid: "anonymous", isAnonymous: true } as never);
    await expect(repository.saveFont(font)).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    expect(mockedGetDocs).not.toHaveBeenCalled();
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it.each([
    ["save", () => repository.saveFont(font), mockedSetDoc],
    ["update lookup", () => repository.updateFont("font-1", font), mockedGetDoc],
    ["get", () => repository.getFont("font-1"), mockedGetDoc],
    ["list", () => repository.listFonts(), mockedGetDocs],
    ["delete", () => repository.deleteFont("font-1"), mockedDeleteDoc],
  ] as const)("translates %s Firestore failures and preserves the cause", async (_name, action, mock) => {
    const cause = new Error("Firestore unavailable");
    mock.mockRejectedValue(cause);
    const error = await action().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FirestoreOperationError);
    expect((error as FirestoreOperationError).cause).toBe(cause);
  });

  it("translates update write failures and preserves the raw cause", async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => true } as never);
    const cause = new Error("Firestore unavailable");
    mockedSetDoc.mockRejectedValue(cause);
    const error = await repository.updateFont("font-1", font).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FirestoreOperationError);
    expect((error as FirestoreOperationError).cause).toBe(cause);
  });
});
