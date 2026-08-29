import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: vi.fn(() => ({ uid: "user-1", isAnonymous: false })),
}));

import {
  MAX_FOLDER_NAME_LENGTH,
  isValidFolderName,
  normalizeFolderName,
} from "../src/features/persistence/presentation-folder";
import { FirestorePresentationFolderRepository } from "../src/features/persistence/firestore-presentation-folder-repository";
import { InvalidFolderNameError } from "../src/features/persistence/persistence-errors";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "../src/features/persistence/firebase-client";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";

const mockedCollection = vi.mocked(collection);
const mockedDeleteDoc = vi.mocked(deleteDoc);
const mockedDoc = vi.mocked(doc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedOrderBy = vi.mocked(orderBy);
const mockedServerTimestamp = vi.mocked(serverTimestamp);
const mockedSetDoc = vi.mocked(setDoc);
const mockedUpdateDoc = vi.mocked(updateDoc);
const mockedGetFirestore = vi.mocked(getFirebaseFirestore);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);

const repository = new FirestorePresentationFolderRepository();

describe("folder name validation", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeFolderName("  My Folder  ")).toBe("My Folder");
  });

  it("rejects empty names after trimming", () => {
    expect(isValidFolderName("")).toBe(false);
    expect(isValidFolderName("   ")).toBe(false);
  });

  it("accepts valid names", () => {
    expect(isValidFolderName("Math")).toBe(true);
    expect(isValidFolderName("  Math  ")).toBe(true);
  });

  it("rejects names longer than the configured bound", () => {
    expect(isValidFolderName("a".repeat(MAX_FOLDER_NAME_LENGTH))).toBe(true);
    expect(isValidFolderName("a".repeat(MAX_FOLDER_NAME_LENGTH + 1))).toBe(false);
  });
});

describe("presentation folder repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFirestore.mockReturnValue({} as never);
    mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false } as never);
    mockedServerTimestamp.mockReturnValue("server-ts" as never);
  });

  it("creates folders under users/{uid}/presentationFolders with a trimmed name and returns the created id", async () => {
    mockedDoc.mockReturnValue({ id: "folder-1" } as never);

    const id = await repository.createFolder("  Physics  ");

    expect(id).toBe("folder-1");
    expect(mockedCollection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentationFolders",
    );
    const payload = mockedSetDoc.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
    expect(payload?.name).toBe("Physics");
    expect(payload).toHaveProperty("createdAt");
    expect(payload).toHaveProperty("updatedAt");
  });

  it("rejects an empty folder name without writing", async () => {
    await expect(repository.createFolder("   ")).rejects.toThrow(InvalidFolderNameError);
    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it("lists folders from the same collection path", async () => {
    mockedGetDocs.mockResolvedValue({
      docs: [
        { id: "folder-1", data: () => ({ name: "Math", createdAt: "c1", updatedAt: "u1" }) },
        { id: "folder-2", data: () => ({ name: "Science", createdAt: "c2", updatedAt: "u2" }) },
      ],
    } as never);

    const folders = await repository.listFolders();

    expect(mockedCollection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentationFolders",
    );
    expect(mockedOrderBy).toHaveBeenCalledWith("createdAt", "asc");
    expect(folders).toEqual([
      { id: "folder-1", name: "Math", createdAt: "c1", updatedAt: "u1" },
      { id: "folder-2", name: "Science", createdAt: "c2", updatedAt: "u2" },
    ]);
  });

  it("skips malformed folder documents", async () => {
    mockedGetDocs.mockResolvedValue({
      docs: [
        { id: "bad", data: () => ({ name: 42 }) },
        { id: "empty", data: () => ({ name: "   " }) },
        { id: "good", data: () => ({ name: "Valid" }) },
      ],
    } as never);

    const folders = await repository.listFolders();

    expect(folders.map((folder) => folder.id)).toEqual(["good"]);
  });

  it("renames a folder with a single document update", async () => {
    mockedDoc.mockReturnValue({ id: "folder-1" } as never);

    await repository.renameFolder("folder-1", "  Biology  ");

    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentationFolders",
      "folder-1",
    );
    const payload = mockedUpdateDoc.mock.calls[0]?.[1] as unknown as Record<string, unknown>;
    expect(payload?.name).toBe("Biology");
    expect(payload).toHaveProperty("updatedAt");
  });

  it("rejects an invalid rename without writing", async () => {
    await expect(repository.renameFolder("folder-1", "")).rejects.toThrow(InvalidFolderNameError);
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it("deletes only the exact private folder document", async () => {
    await repository.deleteFolder("folder-1");

    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentationFolders",
      "folder-1",
    );
    expect(mockedDeleteDoc).toHaveBeenCalledWith({ id: "folder-1" });
    expect(mockedSetDoc).not.toHaveBeenCalled();
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });
});
