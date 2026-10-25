import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadMocks = vi.hoisted(() => ({
  upload: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(),
  intents: [] as Record<string, unknown>[],
  uploadSucceeded: new Set<string>(),
  recoveryStatuses: new Map<string, string>(),
  events: [] as string[],
}));

vi.mock("@vercel/blob/client", () => ({
  upload: uploadMocks.upload,
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseAuth: authMocks.getFirebaseAuth,
}));

import {
  listManagedAssetUploadIntents,
  resumeManagedAssetUpload,
  resumeManagedFontAssetUpload,
  uploadManagedAsset,
  uploadManagedFontAsset,
} from "../src/features/persistence/managed-asset-storage";
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
const secondAssetId = "123e4567-e89b-12d3-a456-426614174001";
const user = {
  getIdToken: vi.fn(),
  isAnonymous: false,
  uid: "user-1",
};

function file(name = "asset.png", type = "image/png", contents = "font-data") {
  return new File([contents], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  let uuidIndex = 0;
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => [assetId, secondAssetId][uuidIndex++] ?? "123e4567-e89b-12d3-a456-426614174002") });
  user.getIdToken.mockResolvedValue("firebase-id-token");
  authMocks.getFirebaseAuth.mockReturnValue({ currentUser: user });
  authMocks.uploadSucceeded.clear();
  authMocks.recoveryStatuses.clear();
  authMocks.intents.length = 0;
  authMocks.events.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/managed-assets/intents") && init?.method !== "POST") {
      return new Response(JSON.stringify({ intents: authMocks.intents }), { status: 200 });
    }
    if (url.endsWith("/api/managed-assets/intents") || url.endsWith("/api/managed-assets/fonts/intents")) {
      const lastIntent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const purpose = url.endsWith("/fonts/intents") ? "fonts" : "generic";
      authMocks.events.push("persist-intent");
      const existing = authMocks.intents.find((intent) => intent.assetId === lastIntent?.assetId);
      if (existing && existing.purpose !== purpose) return new Response(JSON.stringify({ error: "conflict" }), { status: 409 });
      if (!existing) authMocks.intents.push({ ...lastIntent, purpose, state: "pending" });
      return new Response(JSON.stringify({ intent: { ...lastIntent, purpose } }), { status: 201 });
    }
    const recovery = JSON.parse(String(init?.body)) as { assetId: string };
    const intent = authMocks.intents.find((candidate) => candidate.assetId === recovery.assetId);
    const forcedStatus = authMocks.recoveryStatuses.get(recovery.assetId);
    if (forcedStatus) return new Response(JSON.stringify({ status: forcedStatus }), { status: 200 });
    if (!authMocks.uploadSucceeded.has(recovery.assetId)) {
      return new Response(JSON.stringify({ status: intent?.state === "uploading" ? "in_progress" : "absent" }), { status: 200 });
    }
    const path = `users/user-1/assets/${String(intent?.assetId)}${String(intent?.extension)}`;
    return new Response(JSON.stringify({
      status: "complete",
      result: {
        assetId: intent?.assetId,
        storagePath: path,
        downloadUrl: `https://blob.vercel-storage.com/${path}?download=1`,
        contentType: intent?.contentType,
        sizeBytes: intent?.expectedSizeBytes,
        etag: "0123456789abcdef0123456789abcdef",
      },
    }), { status: 200 });
  }));
  uploadMocks.upload.mockImplementation(async (pathname: string, _file: File, options: { contentType: string }) => {
    authMocks.events.push("transfer-bytes");
    const operationId = pathname.match(/[0-9a-f-]{36}/i)?.[0];
    const intent = authMocks.intents.find((candidate) => candidate.assetId === operationId);
    if (intent) intent.state = "uploading";
    if (operationId) authMocks.uploadSucceeded.add(operationId);
    if (intent) intent.state = "complete";
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
    const result = await uploadManagedFontAsset(file("my font.ttf", "font/ttf"));

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
          purpose: "fonts",
        }),
        contentType: "font/ttf",
        handleUploadUrl: "/api/managed-assets/upload",
      }),
    );
  });

  it("creates different physical identities for distinct uploads with identical file descriptors", async () => {
    const sameFile = file("same-name.ttf");
    const first = await uploadManagedFontAsset(sameFile);
    const second = await uploadManagedFontAsset(sameFile);

    expect(first.assetId).toBe(assetId);
    expect(second.assetId).toBe(secondAssetId);
    expect(first.storagePath).not.toBe(second.storagePath);
    expect(uploadMocks.upload).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a prior completed intent when the browser identity is missing", async () => {
    const sameFile = file("completed-before-reload.ttf");
    authMocks.intents.push({
      assetId: secondAssetId,
      storagePath: `users/user-1/assets/${secondAssetId}.ttf`,
      originalFilename: sameFile.name,
      extension: ".ttf",
      contentType: "font/ttf",
      expectedSizeBytes: sameFile.size,
      sourceLastModified: sameFile.lastModified,
      state: "complete",
    });
    authMocks.uploadSucceeded.add(secondAssetId);

    const result = await uploadManagedFontAsset(sameFile);

    expect(result.assetId).toBe(assetId);
    expect(uploadMocks.upload).toHaveBeenCalledWith(
      `users/user-1/assets/${assetId}.ttf`,
      sameFile,
      expect.any(Object),
    );
  });

  it("requires explicit asset selection when matching pending intents are ambiguous", async () => {
    const sameFile = file("ambiguous.ttf");
    for (const candidateId of [assetId, secondAssetId]) {
      authMocks.intents.push({
        assetId: candidateId,
        storagePath: `users/user-1/assets/${candidateId}.ttf`,
        originalFilename: sameFile.name,
        extension: ".ttf",
        contentType: "font/ttf",
        expectedSizeBytes: sameFile.size,
        sourceLastModified: sameFile.lastModified,
        purpose: "fonts",
        state: "pending",
      });
    }

    expect(await listManagedAssetUploadIntents()).toHaveLength(2);
    const resumed = await resumeManagedFontAssetUpload(sameFile, secondAssetId);
    expect(resumed.assetId).toBe(secondAssetId);
    expect(uploadMocks.upload.mock.calls[0]?.[0]).toBe(`users/user-1/assets/${secondAssetId}.ttf`);
  });

  it.each([
    ["font-face.ttf", "font/ttf", ".ttf"],
    ["library-image.png", "image/png", ".png"],
  ])("resumes a selected %s operation using the shared uploader", async (filename, contentType, extension) => {
    const selectedFile = file(filename, contentType);
    authMocks.intents.push({
      assetId: secondAssetId,
      storagePath: `users/user-1/assets/${secondAssetId}${extension}`,
      originalFilename: selectedFile.name,
      extension,
      contentType,
      expectedSizeBytes: selectedFile.size,
      sourceLastModified: selectedFile.lastModified,
      purpose: extension === ".ttf" ? "fonts" : "generic",
      state: "pending",
    });

    const result = extension === ".ttf"
      ? await resumeManagedFontAssetUpload(selectedFile, secondAssetId)
      : await resumeManagedAssetUpload(selectedFile, secondAssetId);

    expect(result.assetId).toBe(secondAssetId);
    expect(result.storagePath).toBe(`users/user-1/assets/${secondAssetId}${extension}`);
    expect(uploadMocks.upload).toHaveBeenCalledOnce();
  });

  it("blocks a new upload when an identical prior operation remains uncertain", async () => {
    const sameFile = file("uncertain.ttf");
    authMocks.intents.push({
      assetId,
      storagePath: `users/user-1/assets/${assetId}.ttf`,
      originalFilename: sameFile.name,
      extension: ".ttf",
      contentType: "font/ttf",
      expectedSizeBytes: sameFile.size,
      sourceLastModified: sameFile.lastModified,
      purpose: "fonts",
      state: "uncertain",
    });

    await expect(uploadManagedFontAsset(sameFile)).rejects.toMatchObject({ category: "uncertain_completion" });
    expect(uploadMocks.upload).not.toHaveBeenCalled();
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
          purpose: "generic",
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
          purpose: "generic",
        }),
        contentType: "text/plain",
      }),
    );
  });

  it("allows an explicit content type to override the File MIME", async () => {
    const result = await uploadManagedFontAsset(
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
          purpose: "fonts",
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

  it.each([".ttf", ".otf", ".woff", ".woff2"])("generic uploader rejects font extension %s before creating an intent", async (extension) => {
    const response = await uploadManagedAsset(file(`blocked${extension}`, "application/octet-stream")).catch((error: unknown) => error);
    expect(response).toBeInstanceOf(ManagedAssetUploadError);
    expect(fetch).not.toHaveBeenCalled();
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });

  it("rejects unsupported extensions before requesting an upload token", async () => {
    await expect(uploadManagedAsset(file("payload.exe", "application/octet-stream"))).rejects.toBeInstanceOf(ManagedAssetUploadError);
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });

  it("resumes a selected UUID operation without issuing another transfer after completion", async () => {
    const selectedFile = file("font.ttf");
    await uploadManagedFontAsset(selectedFile);
    await resumeManagedFontAssetUpload(selectedFile, assetId);

    expect(uploadMocks.upload.mock.calls.map(([pathname]) => pathname)).toEqual([
      `users/user-1/assets/${assetId}.ttf`,
    ]);
  });

  it("lists a persisted operation after reload and requires explicit selection to recover it", async () => {
    const sameFile = file("restart.ttf", "font/ttf");
    uploadMocks.upload.mockImplementationOnce(async () => {
      authMocks.events.push("transfer-bytes");
      const intent = authMocks.intents[0];
      if (intent) intent.state = "uploading";
      throw new TypeError("connection ended after request");
    });
    await expect(uploadManagedFontAsset(sameFile)).rejects.toBeInstanceOf(ManagedAssetUploadError);
    expect(authMocks.events.indexOf("persist-intent")).toBeLessThan(authMocks.events.indexOf("transfer-bytes"));
    const operations = await listManagedAssetUploadIntents();
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({ assetId, state: "uploading" });
    authMocks.recoveryStatuses.set(assetId, "uncertain");
    await expect(resumeManagedFontAssetUpload(sameFile, assetId)).rejects.toMatchObject({ category: "uncertain_completion" });
    expect(uploadMocks.upload).toHaveBeenCalledOnce();
  });

  it("reconciles a completed legacy font intent before requiring a purpose", async () => {
    const legacyFile = file("legacy.ttf", "font/ttf");
    authMocks.intents.push({
      assetId,
      storagePath: `users/user-1/assets/${assetId}.ttf`,
      originalFilename: legacyFile.name,
      extension: ".ttf",
      contentType: "font/ttf",
      expectedSizeBytes: legacyFile.size,
      sourceLastModified: legacyFile.lastModified,
      state: "pending",
    });
    authMocks.uploadSucceeded.add(assetId);

    await expect(resumeManagedFontAssetUpload(legacyFile, assetId)).resolves.toMatchObject({
      assetId,
      storagePath: `users/user-1/assets/${assetId}.ttf`,
    });
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });

  it("requires a fresh operation instead of transferring from a legacy intent without purpose", async () => {
    const legacyFile = file("legacy-pending.ttf", "font/ttf");
    authMocks.intents.push({
      assetId,
      storagePath: `users/user-1/assets/${assetId}.ttf`,
      originalFilename: legacyFile.name,
      extension: ".ttf",
      contentType: "font/ttf",
      expectedSizeBytes: legacyFile.size,
      sourceLastModified: legacyFile.lastModified,
      state: "pending",
    });

    await expect(resumeManagedFontAssetUpload(legacyFile, assetId)).rejects.toThrow("no recorded purpose");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith("/api/managed-assets/fonts/intents", expect.anything());
    expect(uploadMocks.upload).not.toHaveBeenCalled();
  });

  it("recovers a completed physical upload when the client loses its upload response", async () => {
    uploadMocks.upload.mockImplementationOnce(async () => {
      authMocks.uploadSucceeded.add(assetId);
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
    { url: "https://blob.vercel-storage.com/file", downloadUrl: "https://blob.vercel-storage.com/file?download=1", pathname: `users/user-1/assets/${assetId}.png`, contentType: "image/png", etag: undefined },
    { url: "https://blob.vercel-storage.com/file", downloadUrl: "https://blob.vercel-storage.com/file?download=1", pathname: `users/user-1/assets/${assetId}.png`, contentType: "image/png", etag: "has whitespace" },
    { url: "https://blob.vercel-storage.com/file", downloadUrl: "https://blob.vercel-storage.com/file?download=1", pathname: `users/user-1/assets/${assetId}.png`, contentType: "application/octet-stream", etag: "0123456789abcdef0123456789abcdef" },
  ])("uses verified server metadata even when the client upload response is incomplete", async (response) => {
    uploadMocks.upload.mockImplementationOnce(async () => {
      authMocks.uploadSucceeded.add(assetId);
      return response;
    });

    await expect(uploadManagedAsset(file())).resolves.toMatchObject({
      etag: "0123456789abcdef0123456789abcdef",
      sizeBytes: 9,
      contentType: "image/png",
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
