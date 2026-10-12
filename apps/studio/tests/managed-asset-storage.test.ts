import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadMocks = vi.hoisted(() => ({
  upload: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(),
  uploadSucceeded: false,
  intents: [] as Record<string, unknown>[],
  events: [] as string[],
  localStorage: new Map<string, string>(),
}));

vi.mock("@vercel/blob/client", () => ({
  upload: uploadMocks.upload,
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseAuth: authMocks.getFirebaseAuth,
}));

import { uploadManagedAsset } from "../src/features/persistence/managed-asset-storage";
import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobContentTypeNotAllowedError,
  BlobFileTooLargeError,
  BlobPathnameMismatchError,
  BlobPreconditionFailedError,
  BlobRequestAbortedError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobUnknownError,
} from "@vercel/blob";
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
  let recoveryCount = 0;
  let lastIntent: Record<string, unknown> | undefined;
  authMocks.uploadSucceeded = false;
  authMocks.intents.length = 0;
  authMocks.events.length = 0;
  authMocks.localStorage.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => authMocks.localStorage.get(key) ?? null,
      setItem: (key: string, value: string) => authMocks.localStorage.set(key, value),
      removeItem: (key: string) => authMocks.localStorage.delete(key),
    },
  });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/managed-assets/intents") && init?.method !== "POST") {
      return new Response(JSON.stringify({ intents: authMocks.intents }), { status: 200 });
    }
    if (url.endsWith("/api/managed-assets/intents")) {
      lastIntent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      authMocks.events.push("persist-intent");
      if (!authMocks.intents.some((intent) => intent.assetId === lastIntent?.assetId)) authMocks.intents.push(lastIntent);
      return new Response(JSON.stringify({ intent: lastIntent }), { status: 201 });
    }
    recoveryCount += 1;
    if (recoveryCount === 1) return new Response(JSON.stringify({ status: "absent" }), { status: 200 });
    if (!authMocks.uploadSucceeded) return new Response(JSON.stringify({ status: "absent" }), { status: 200 });
    const path = `users/user-1/assets/${String(lastIntent?.assetId)}${String(lastIntent?.extension)}`;
    return new Response(JSON.stringify({
      status: "complete",
      result: {
        assetId: lastIntent?.assetId,
        storagePath: path,
        downloadUrl: `https://blob.vercel-storage.com/${path}?download=1`,
        contentType: lastIntent?.contentType,
        sizeBytes: lastIntent?.expectedSizeBytes,
        etag: "0123456789abcdef0123456789abcdef",
      },
    }), { status: 200 });
  }));
  uploadMocks.upload.mockImplementation(async (pathname: string, _file: File, options: { contentType: string }) => {
    authMocks.events.push("transfer-bytes");
    authMocks.uploadSucceeded = true;
    return {
      url: `https://blob.vercel-storage.com/${pathname}`,
      downloadUrl: `https://blob.vercel-storage.com/${pathname}?download=1`,
      pathname,
      contentType: options.contentType,
      etag: "client-etag-must-not-be-used",
    };
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
      storagePath: `users/user-1/assets/${assetId}.ttf`,
      downloadUrl:
        `https://blob.vercel-storage.com/users/user-1/assets/${assetId}.ttf?download=1`,
      contentType: "font/ttf",
      sizeBytes: 9,
      etag: "0123456789abcdef0123456789abcdef",
    });
    expect(result.storagePath).not.toContain("my font.ttf");
    expect(user.getIdToken).toHaveBeenCalledOnce();
    expect(uploadMocks.upload).toHaveBeenCalledWith(
      `users/user-1/assets/${assetId}.ttf`,
      expect.any(File),
      expect.objectContaining({
        access: "public",
        clientPayload: JSON.stringify({
          idToken: "firebase-id-token",
          contentType: "font/ttf",
          assetId,
          expectedSizeBytes: 9,
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
          assetId,
          expectedSizeBytes: 9,
        }),
        contentType: "text/plain",
      }),
    );
  });

  it("uses the canonical MIME for an empty File MIME", async () => {
    const result = await uploadManagedAsset(file("notes.txt", ""));

    expect(result.contentType).toBe("text/plain");
    expect(uploadMocks.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(File),
      expect.objectContaining({
        clientPayload: JSON.stringify({
          idToken: "firebase-id-token",
          contentType: "text/plain",
          assetId,
          expectedSizeBytes: 9,
        }),
        contentType: "text/plain",
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
          assetId,
          expectedSizeBytes: 9,
        }),
        contentType: "font/woff2",
      }),
    );
  });

  it("rejects an explicit MIME that disagrees with the filename", async () => {
    await expect(
      uploadManagedAsset(file("photo.png", "image/png"), { contentType: "image/jpeg" }),
      ).rejects.toMatchObject({ category: "unsupported_type" });
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });

  it("rejects unsupported extensions before requesting an upload token", async () => {
    await expect(uploadManagedAsset(file("payload.exe", "application/octet-stream"))).rejects.toBeInstanceOf(ManagedAssetUploadError);
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });

  it("reuses an explicit UUID identity for retries of one upload operation", async () => {
    await uploadManagedAsset(file("font.ttf"), { assetId });
    await uploadManagedAsset(file("font.ttf"), { assetId });

    expect(uploadMocks.upload.mock.calls.map(([pathname]) => pathname)).toEqual([
      `users/user-1/assets/${assetId}.ttf`,
    ]);
  });

  it("persists the intent before transferring bytes and discovers it after a browser restart", async () => {
    const sameFile = file("restart.ttf");
    uploadMocks.upload.mockImplementationOnce(async () => {
      authMocks.events.push("transfer-bytes");
      throw new TypeError("connection ended after request");
    });
    await expect(uploadManagedAsset(sameFile)).rejects.toBeInstanceOf(ManagedAssetUploadError);
    expect(authMocks.events.indexOf("persist-intent")).toBeLessThan(authMocks.events.indexOf("transfer-bytes"));
    const firstPath = uploadMocks.upload.mock.calls[0]?.[0];

    authMocks.localStorage.clear();
    await uploadManagedAsset(sameFile);
    expect(uploadMocks.upload.mock.calls[1]?.[0]).toBe(firstPath);
    expect(authMocks.intents).toHaveLength(1);
  });

  it("recovers a completed physical upload when the client loses its upload response", async () => {
    uploadMocks.upload.mockImplementationOnce(async () => {
      authMocks.uploadSucceeded = true;
      throw new TypeError("response lost after physical completion");
    });

    await expect(uploadManagedAsset(file("lost-response.mp3", "audio/mpeg"))).resolves.toMatchObject({
      assetId,
      storagePath: `users/user-1/assets/${assetId}.mp3`,
      contentType: "audio/mpeg",
      etag: "0123456789abcdef0123456789abcdef",
    });
    expect(uploadMocks.upload).toHaveBeenCalledOnce();
  });

  it("does not call Blob when durable intent creation fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ intents: [] }), { status: 200 }));
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }));

    await expect(uploadManagedAsset(file("no-intent.mp3", "audio/mpeg"))).rejects.toBeInstanceOf(ManagedAssetUploadError);
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });

  it.each([
    { url: "https://blob.vercel-storage.com/file", downloadUrl: "https://blob.vercel-storage.com/file?download=1", pathname: `users/user-1/assets/${assetId}.ttf`, contentType: "font/ttf", etag: undefined },
    { url: "https://blob.vercel-storage.com/file", downloadUrl: "https://blob.vercel-storage.com/file?download=1", pathname: `users/user-1/assets/${assetId}.ttf`, contentType: "font/ttf", etag: "has whitespace" },
    { url: "https://blob.vercel-storage.com/file", downloadUrl: "https://blob.vercel-storage.com/file?download=1", pathname: `users/user-1/assets/${assetId}.ttf`, contentType: "application/octet-stream", etag: "0123456789abcdef0123456789abcdef" },
  ])("uses verified server metadata even when the client upload response is incomplete", async (response) => {
    uploadMocks.upload.mockImplementationOnce(async () => {
      authMocks.uploadSucceeded = true;
      return response;
    });

    await expect(uploadManagedAsset(file())).resolves.toMatchObject({
      etag: "0123456789abcdef0123456789abcdef",
      sizeBytes: 9,
      contentType: "font/ttf",
    });
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

  it.each([
    [new BlobAccessError(), "authorization"],
    [new BlobClientTokenExpiredError(), "authentication"],
    [new BlobContentTypeNotAllowedError("type"), "unsupported_type"],
    [new BlobFileTooLargeError("size"), "file_too_large"],
    [new BlobPathnameMismatchError("path"), "authorization"],
    [new BlobPreconditionFailedError(), "uncertain_completion"],
    [new BlobStoreSuspendedError(), "store_suspended"],
    [new BlobStoreNotFoundError(), "service_unavailable"],
    [new BlobServiceRateLimited(), "rate_limited"],
    [new BlobServiceNotAvailable(), "service_unavailable"],
    [new BlobRequestAbortedError(), "uncertain_completion"],
    [new BlobUnknownError(), "unknown"],
  ] as const)("classifies Blob SDK failures", async (cause, category) => {
    uploadMocks.upload.mockRejectedValueOnce(cause);
    const error = await uploadManagedAsset(file()).catch((value: unknown) => value);
    expect((error as ManagedAssetUploadError).category).toBe(category);
  });

  it("never infers quota exhaustion from a generic error", async () => {
    uploadMocks.upload.mockRejectedValueOnce(new Error("HTTP 500"));
    const error = await uploadManagedAsset(file()).catch((value: unknown) => value);
    expect((error as ManagedAssetUploadError).category).toBe("unknown");
  });

  it("treats an unclassified TypeError as uncertain completion", async () => {
    uploadMocks.upload.mockRejectedValueOnce(new TypeError("request failed"));
    const error = await uploadManagedAsset(file()).catch((value: unknown) => value);
    expect((error as ManagedAssetUploadError).category).toBe("uncertain_completion");
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
