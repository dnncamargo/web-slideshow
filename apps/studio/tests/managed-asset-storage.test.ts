import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(),
  getFirebaseStorage: vi.fn(),
}));

vi.mock("firebase/storage", () => ({
  getDownloadURL: storageMocks.getDownloadURL,
  ref: storageMocks.ref,
  uploadBytes: storageMocks.uploadBytes,
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseAuth: authMocks.getFirebaseAuth,
  getFirebaseStorage: authMocks.getFirebaseStorage,
}));

import { uploadManagedAsset } from "../src/features/persistence/managed-asset-storage";
import {
  FirebaseAuthenticationError,
  FirebaseStorageOperationError,
} from "../src/features/persistence/persistence-errors";

const storage = { name: "storage" };
const storageRef = { fullPath: "users/user-1/assets/asset-1" };

function file(name = "font.ttf", type = "font/ttf", contents = "font-data") {
  return new File([contents], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.getFirebaseAuth.mockReturnValue({
    currentUser: { uid: "user-1", isAnonymous: false },
  });
  authMocks.getFirebaseStorage.mockReturnValue(storage);
  storageMocks.ref.mockReturnValue(storageRef);
  storageMocks.uploadBytes.mockResolvedValue({ metadata: {} });
  storageMocks.getDownloadURL.mockResolvedValue(
    "https://firebasestorage.googleapis.com/download/asset-1",
  );
});

describe("uploadManagedAsset", () => {
  it("uploads under the current user's owner-scoped path with a generated asset ID", async () => {
    const result = await uploadManagedAsset(file("my font.ttf"));

    expect(result).toEqual({
      assetId: expect.any(String),
      storagePath: expect.stringMatching(/^users\/user-1\/assets\/[0-9a-f-]+$/),
      downloadUrl: "https://firebasestorage.googleapis.com/download/asset-1",
      contentType: "font/ttf",
      sizeBytes: 9,
    });
    expect(result.storagePath).not.toContain("my font.ttf");
    expect(storageMocks.ref).toHaveBeenCalledWith(
      storage,
      result.storagePath,
    );
    expect(storageMocks.uploadBytes).toHaveBeenCalledWith(
      storageRef,
      expect.any(File),
      { contentType: "font/ttf" },
    );
    expect(storageMocks.getDownloadURL).toHaveBeenCalledWith(storageRef);
  });

  it("returns an empty content type without inventing one when the File has none", async () => {
    const result = await uploadManagedAsset(file("notes.txt", ""));

    expect(result.contentType).toBe("");
    expect(storageMocks.uploadBytes).toHaveBeenCalledWith(
      storageRef,
      expect.any(File),
      {},
    );
  });

  it("allows an explicit content type to override an empty File MIME", async () => {
    const result = await uploadManagedAsset(file("font.woff2", ""), {
      contentType: "font/woff2",
    });

    expect(result.contentType).toBe("font/woff2");
    expect(storageMocks.uploadBytes).toHaveBeenCalledWith(
      storageRef,
      expect.any(File),
      { contentType: "font/woff2" },
    );
  });

  it("allows an explicit content type to override a conflicting File MIME", async () => {
    const result = await uploadManagedAsset(file("font.woff2", "application/octet-stream"), {
      contentType: "font/woff2",
    });

    expect(result.contentType).toBe("font/woff2");
    expect(storageMocks.uploadBytes).toHaveBeenCalledWith(
      storageRef,
      expect.any(File),
      { contentType: "font/woff2" },
    );
  });

  it("translates upload failures into the persistence error model", async () => {
    const cause = new Error("storage unavailable");
    storageMocks.uploadBytes.mockRejectedValue(cause);

    const error = await uploadManagedAsset(file()).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(FirebaseStorageOperationError);
    expect((error as FirebaseStorageOperationError).cause).toBe(cause);
  });

  it("translates download URL failures into the persistence error model", async () => {
    const cause = new Error("download URL unavailable");
    storageMocks.getDownloadURL.mockRejectedValue(cause);

    const error = await uploadManagedAsset(file()).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(FirebaseStorageOperationError);
    expect((error as FirebaseStorageOperationError).cause).toBe(cause);
  });

  it("uses the existing non-anonymous authoring guard", async () => {
    authMocks.getFirebaseAuth.mockReturnValue({ currentUser: null });
    await expect(uploadManagedAsset(file())).rejects.toBeInstanceOf(
      FirebaseAuthenticationError,
    );
    expect(storageMocks.ref).not.toHaveBeenCalled();
    expect(storageMocks.uploadBytes).not.toHaveBeenCalled();

    authMocks.getFirebaseAuth.mockReturnValue({
      currentUser: { uid: "anonymous", isAnonymous: true },
    });
    await expect(uploadManagedAsset(file())).rejects.toBeInstanceOf(
      FirebaseAuthenticationError,
    );
    expect(storageMocks.uploadBytes).not.toHaveBeenCalled();
  });
});
