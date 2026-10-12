import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(),
}));
vi.mock("../src/features/persistence/firebase-client", () => ({ getFirebaseFirestore: vi.fn(() => ({})) }));
vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: vi.fn(() => ({ uid: "user-1", isAnonymous: false, getIdToken: async () => "id-token" })),
}));

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getCurrentNonAnonymousUser } from "../src/features/auth/firebase-auth";
import { FirestoreCustomLibraryFontRepository } from "../src/features/persistence/firestore-custom-library-font-repository";
import {
  CustomLibraryFontRemovalDeniedError,
  FirebaseAuthenticationError,
  FirestoreOperationError,
  InvalidCustomLibraryFontForPersistenceError,
  InvalidPersistedCustomLibraryFontError,
} from "../src/features/persistence/persistence-errors";

const mockedCollection = vi.mocked(collection);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedGetCurrentUser = vi.mocked(getCurrentNonAnonymousUser);
const repository = new FirestoreCustomLibraryFontRepository();
const font = { family: "Inter", faces: [{ weight: 400, style: "normal" as const, provenance: { kind: "external-url" as const }, source: {
  type: "url" as const, url: "https://fonts.example.test/font.woff2", format: "woff2" as const,
} }] };

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockReturnValue({ uid: "user-1", isAnonymous: false, getIdToken: async () => "id-token" } as never);
  mockedDoc.mockImplementation((...args) => args.length === 1
    ? { id: "generated-font-id" } as never
    : { id: String(args.at(-1)) } as never);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "generated-font-id" }, { status: 201 })));
});

describe("FirestoreCustomLibraryFontRepository", () => {
  it("saves validated provenance through the owner-authenticated server boundary", async () => {
    await expect(repository.saveFont(font)).resolves.toBe("generated-font-id");
    expect(fetch).toHaveBeenCalledWith("/api/custom-library/fonts", expect.objectContaining({
      method: "POST",
      headers: { Authorization: "Bearer id-token", "Content-Type": "application/json" },
    }));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({ operation: "save", font });
    expect(mockedCollection).not.toHaveBeenCalled();
  });

  it("passes a stable document identity for retry after a lost response", async () => {
    const documentId = "123e4567-e89b-12d3-a456-426614174000";
    const request = vi.fn()
      .mockRejectedValueOnce(new Error("connection lost after commit"))
      .mockResolvedValueOnce(Response.json({ id: documentId }, { status: 200 }));
    vi.stubGlobal("fetch", request);

    await expect(repository.saveFont(font, { documentId })).rejects.toBeInstanceOf(FirestoreOperationError);
    await expect(repository.saveFont(font, { documentId })).resolves.toBe(documentId);
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({ operation: "save", font, documentId });
  });

  it("rejects invalid drafts before a server write", async () => {
    await expect(repository.saveFont({ ...font, family: " Inter " })).rejects.toBeInstanceOf(InvalidCustomLibraryFontForPersistenceError);
    expect(fetch).not.toHaveBeenCalled();
    await expect(repository.updateFont("font-1", { ...font, faces: [] })).rejects.toBeInstanceOf(InvalidCustomLibraryFontForPersistenceError);
    expect(fetch).not.toHaveBeenCalled();
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

  it("routes updates and deletes through the server authorization boundary", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", request);
    await repository.updateFont("font-1", font);
    await repository.deleteFont("font-1");
    expect(request.mock.calls.map((call) => call[1]?.method)).toEqual(["PUT", "DELETE"]);
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({ operation: "update", id: "font-1", font });
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body))).toEqual({ operation: "delete", id: "font-1" });
    expect(mockedDoc).not.toHaveBeenCalled();
  });

  it("surfaces authoritative managed-face removal denial", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "managed_face_removal_denied" }, { status: 403 })));
    await expect(repository.deleteFont("font-1")).rejects.toBeInstanceOf(CustomLibraryFontRemovalDeniedError);
  });

  it("rejects unauthenticated and anonymous users through the existing boundary", async () => {
    mockedGetCurrentUser.mockReturnValue(null);
    await expect(repository.listFonts()).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    mockedGetCurrentUser.mockReturnValue({ uid: "anonymous", isAnonymous: true } as never);
    await expect(repository.saveFont(font)).rejects.toBeInstanceOf(FirebaseAuthenticationError);
    expect(fetch).not.toHaveBeenCalled();
    expect(mockedGetDocs).not.toHaveBeenCalled();
  });

  it("translates server write and Firestore read failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "unavailable" }, { status: 503 })));
    await expect(repository.saveFont(font)).rejects.toBeInstanceOf(FirestoreOperationError);
    const cause = new Error("Firestore unavailable");
    mockedGetDocs.mockRejectedValue(cause);
    const error = await repository.listFonts().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FirestoreOperationError);
    expect((error as FirestoreOperationError).cause).toBe(cause);
  });
});
