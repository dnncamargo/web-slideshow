import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadMocks = vi.hoisted(() => ({
  upload: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({
  upload: uploadMocks.upload,
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseAuth: authMocks.getFirebaseAuth,
}));

import { uploadManagedAsset } from "../src/features/persistence/managed-asset-storage";
import {
  FirebaseAuthenticationError,
  ManagedAssetUploadError,
} from "../src/features/persistence/persistence-errors";

const assetId = "123e4567-e89b-12d3-a456-426614174000";
const user = {
  getIdToken: vi.fn(),
  isAnonymous: false,
  uid: "user-1",
};

function file(name = "font.ttf", type = "font/ttf", contents = "font-data") {
  return new File([contents], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => assetId) });
  user.getIdToken.mockResolvedValue("firebase-id-token");
  authMocks.getFirebaseAuth.mockReturnValue({ currentUser: user });
  uploadMocks.upload.mockResolvedValue({
    url: "https://blob.vercel-storage.com/users/user-1/assets/asset",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadManagedAsset", () => {
  it("uses the authenticated UID and generated UUID for a logical owner-scoped path", async () => {
    const result = await uploadManagedAsset(file("my font.ttf"));

    expect(result).toEqual({
      assetId,
      storagePath: `users/user-1/assets/${assetId}`,
      downloadUrl:
        "https://blob.vercel-storage.com/users/user-1/assets/asset",
      contentType: "font/ttf",
      sizeBytes: 9,
    });
    expect(result.storagePath).not.toContain("my font.ttf");
    expect(user.getIdToken).toHaveBeenCalledOnce();
    expect(uploadMocks.upload).toHaveBeenCalledWith(
      `users/user-1/assets/${assetId}`,
      expect.any(File),
      expect.objectContaining({
        access: "public",
        clientPayload: JSON.stringify({
          idToken: "firebase-id-token",
          contentType: "font/ttf",
        }),
        contentType: "font/ttf",
        handleUploadUrl: "/api/managed-assets/upload",
      }),
    );
  });

  it("uses the File MIME when no content type override is supplied", async () => {
    await uploadManagedAsset(file("notes.txt", "text/plain"));

    expect(uploadMocks.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(File),
      expect.objectContaining({
        clientPayload: JSON.stringify({
          idToken: "firebase-id-token",
          contentType: "text/plain",
        }),
        contentType: "text/plain",
      }),
    );
  });

  it("preserves an empty File MIME without inventing a content type", async () => {
    const result = await uploadManagedAsset(file("notes.txt", ""));

    expect(result.contentType).toBe("");
    expect(uploadMocks.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(File),
      expect.objectContaining({
        clientPayload: JSON.stringify({
          idToken: "firebase-id-token",
          contentType: "",
        }),
        contentType: "",
      }),
    );
  });

  it("allows an explicit content type to override the File MIME", async () => {
    const result = await uploadManagedAsset(
      file("font.woff2", "application/octet-stream"),
      { contentType: "font/woff2" },
    );

    expect(result.contentType).toBe("font/woff2");
    expect(uploadMocks.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(File),
      expect.objectContaining({
        clientPayload: JSON.stringify({
          idToken: "firebase-id-token",
          contentType: "font/woff2",
        }),
        contentType: "font/woff2",
      }),
    );
  });

  it("translates Blob upload failures into the persistence error model", async () => {
    const cause = new Error("storage unavailable");
    uploadMocks.upload.mockRejectedValue(cause);

    const error = await uploadManagedAsset(file()).catch(
      (value: unknown) => value,
    );

    expect(error).toBeInstanceOf(ManagedAssetUploadError);
    expect((error as ManagedAssetUploadError).cause).toBe(cause);
  });

  it("preserves authentication failures before calling Blob", async () => {
    const cause = new Error("token unavailable");
    user.getIdToken.mockRejectedValue(cause);

    const error = await uploadManagedAsset(file()).catch(
      (value: unknown) => value,
    );

    expect(error).toBeInstanceOf(FirebaseAuthenticationError);
    expect((error as FirebaseAuthenticationError).cause).toBe(cause);
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and anonymous users before requesting a token", async () => {
    authMocks.getFirebaseAuth.mockReturnValue({ currentUser: null });
    await expect(uploadManagedAsset(file())).rejects.toBeInstanceOf(
      FirebaseAuthenticationError,
    );
    expect(user.getIdToken).not.toHaveBeenCalled();
    expect(uploadMocks.upload).not.toHaveBeenCalled();

    authMocks.getFirebaseAuth.mockReturnValue({
      currentUser: { isAnonymous: true, uid: "anonymous" },
    });
    await expect(uploadManagedAsset(file())).rejects.toBeInstanceOf(
      FirebaseAuthenticationError,
    );
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });
});
