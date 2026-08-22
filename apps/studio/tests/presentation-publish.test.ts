import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  getFirebaseFirestore: vi.fn(() => ({})),
  getCurrentNonAnonymousUser: vi.fn(() => ({ uid: "user-1", isAnonymous: false })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  runTransaction: mocks.runTransaction,
  serverTimestamp: mocks.serverTimestamp,
  increment: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: mocks.getFirebaseFirestore,
}));

vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: mocks.getCurrentNonAnonymousUser,
}));

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { FirestorePresentationRepository } from "../src/features/persistence/firestore-presentation-repository";
import { PresentationSchema } from "@powershow/document-schema";

const repository = new FirestorePresentationRepository();

function draftData(overrides: Record<string, unknown> = {}) {
  return {
    presentation: createBlankPresentation("pres-1"),
    draftRevision: 3,
    createdAt: "created",
    updatedAt: "updated",
    ...overrides,
  };
}

function setupTransaction(data: Record<string, unknown>, exists = true) {
  const transaction = {
    get: vi.fn(async () => ({
      exists: () => exists,
      data: () => data,
    })),
    set: vi.fn(),
    update: vi.fn(),
  };

  mocks.runTransaction.mockImplementation(
    async (_firestore: unknown, callback: (value: typeof transaction) => unknown) =>
      callback(transaction),
  );

  return transaction;
}

describe("transactional presentation publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFirebaseFirestore.mockReturnValue({});
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "user-1", isAnonymous: false });
    mocks.collection.mockImplementation((...path: unknown[]) => ({ path }));
    mocks.serverTimestamp.mockReturnValue("server-ts");
  });

  it("creates an opaque publication, immutable version, and public pointer on first publish", async () => {
    const transaction = setupTransaction(draftData());
    mocks.doc
      .mockReturnValueOnce({ id: "private-draft" })
      .mockReturnValueOnce({ id: "publication-auto" })
      .mockReturnValueOnce({ id: "version-auto" })
      .mockReturnValueOnce({ id: "pointer-auto" });

    const result = await repository.publishPresentation("pres-1");

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.get).toHaveBeenCalledWith({ id: "private-draft" });
    expect(result).toEqual({
      publicationId: "publication-auto",
      versionId: "version-auto",
      publishedRevision: 3,
      createdVersion: true,
    });
    expect(transaction.set).toHaveBeenCalledWith(
      { id: "version-auto" },
      expect.objectContaining({
        presentation: expect.objectContaining({ id: "pres-1" }),
        publishedRevision: 3,
        publishedAt: "server-ts",
      }),
    );
    const versionPayload = transaction.set.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(versionPayload?.presentation).toEqual(expect.objectContaining({ id: "pres-1" }));
    expect(versionPayload).not.toHaveProperty("draftRevision");
    expect(versionPayload).not.toHaveProperty("createdAt");
    expect(versionPayload).not.toHaveProperty("updatedAt");
    expect(versionPayload).not.toHaveProperty("archivedAt");
    expect(versionPayload).not.toHaveProperty("publication");
    expect(versionPayload.presentation).not.toHaveProperty("publicationId");
    expect(versionPayload.presentation).not.toHaveProperty("publishedRevision");
    // Public pointer is written with the same version/revision/timestamp.
    expect(transaction.set).toHaveBeenCalledWith(
      { id: "pointer-auto" },
      {
        currentVersionId: "version-auto",
        publishedRevision: 3,
        publishedAt: "server-ts",
      },
    );
    expect(transaction.update).toHaveBeenCalledWith(
      { id: "private-draft" },
      {
        publication: {
          publicationId: "publication-auto",
          currentVersionId: "version-auto",
          publishedRevision: 3,
          publishedAt: "server-ts",
        },
      },
    );
  });

  it("reuses publicationId and advances pointer after a newer draft", async () => {
    const transaction = setupTransaction(
      draftData({
        draftRevision: 4,
        publication: {
          publicationId: "publication-existing",
          currentVersionId: "version-old",
          publishedRevision: 3,
          publishedAt: "old-ts",
        },
      }),
    );
    mocks.doc
      .mockReturnValueOnce({ id: "private-draft" })
      .mockReturnValueOnce({ id: "version-new" })
      .mockReturnValueOnce({ id: "pointer-existing" });

    const result = await repository.publishPresentation("pres-1");

    expect(result).toEqual({
      publicationId: "publication-existing",
      versionId: "version-new",
      publishedRevision: 4,
      createdVersion: true,
    });
    expect(transaction.set).toHaveBeenCalledWith(
      { id: "version-new" },
      expect.objectContaining({
        publishedRevision: 4,
        publishedAt: "server-ts",
      }),
    );
    expect(transaction.set).toHaveBeenCalledWith(
      { id: "pointer-existing" },
      {
        currentVersionId: "version-new",
        publishedRevision: 4,
        publishedAt: "server-ts",
      },
    );
    expect(transaction.update).toHaveBeenCalledWith(
      { id: "private-draft" },
      expect.objectContaining({
        publication: expect.objectContaining({
          publicationId: "publication-existing",
          currentVersionId: "version-new",
          publishedRevision: 4,
        }),
      }),
    );
  });

  it("is idempotent when the draft revision is already published: zero writes", async () => {
    const transaction = setupTransaction(
      draftData({
        publication: {
          publicationId: "publication-existing",
          currentVersionId: "version-current",
          publishedRevision: 3,
          publishedAt: "ts",
        },
      }),
    );
    mocks.doc.mockReturnValueOnce({ id: "private-draft" });

    const result = await repository.publishPresentation("pres-1");

    expect(result).toEqual({
      publicationId: "publication-existing",
      versionId: "version-current",
      publishedRevision: 3,
      createdVersion: false,
    });
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
    // No pointer read — only the draft read.
    expect(transaction.get).toHaveBeenCalledTimes(1);
  });

  it("preserves canonical Scripted source exactly in the immutable version payload", async () => {
    const html = '<div data-value="  raw  ">\n  publish &amp; preserve\n</div>\n';
    const css = ".published {\n  padding:  4px;\n}\n";
    const script = 'const raw = "  publish  ";\nconsole.log(raw);\n';
    const presentation = PresentationSchema.parse({
      ...createBlankPresentation("pres-1"),
      slides: [{
        id: "slide-scripted",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [{
          id: "scripted-publish",
          type: "scripted",
          hidden: true,
          title: "Publish exact source",
          html,
          css,
          script,
          style: { width: "71%", height: "41%", className: "published-scripted" },
        }],
      }],
    });
    const transaction = setupTransaction(draftData({ presentation }));
    mocks.doc
      .mockReturnValueOnce({ id: "private-draft" })
      .mockReturnValueOnce({ id: "publication-auto" })
      .mockReturnValueOnce({ id: "version-auto" })
      .mockReturnValueOnce({ id: "pointer-auto" });

    await repository.publishPresentation("pres-1");

    const versionPayload = transaction.set.mock.calls[0]?.[1] as {
      presentation: { slides: Array<{ elements: unknown[] }> };
    };
    expect(versionPayload.presentation.slides[0]?.elements[0]).toEqual({
      id: "scripted-publish",
      type: "scripted",
      hidden: true,
      title: "Publish exact source",
      html,
      css,
      script,
      style: { width: "71%", height: "41%", className: "published-scripted" },
    });
  });

  it("rejects missing, archived, and invalid drafts without public writes", async () => {
    let transaction = setupTransaction(draftData(), false);
    mocks.doc.mockReturnValueOnce({ id: "private-draft" });
    await expect(repository.publishPresentation("pres-1")).rejects.toThrow(
      "Cannot publish missing presentation",
    );
    expect(transaction.set).not.toHaveBeenCalled();

    vi.clearAllMocks();
    transaction = setupTransaction(draftData({ archivedAt: "archived" }));
    mocks.doc.mockReturnValueOnce({ id: "private-draft" });
    await expect(repository.publishPresentation("pres-1")).rejects.toThrow(
      "Cannot publish archived presentation",
    );
    expect(transaction.set).not.toHaveBeenCalled();

    vi.clearAllMocks();
    transaction = setupTransaction({ presentation: { id: "invalid" }, draftRevision: 1 });
    mocks.doc.mockReturnValueOnce({ id: "private-draft" });
    await expect(repository.publishPresentation("pres-1")).rejects.toThrow(
      "Persisted presentation is not a valid PowerShow document",
    );
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("adapts the mount publish callback to repository.publishPresentation(id)", async () => {
    const presentation = createBlankPresentation("pres-mount");
    mocks.doc.mockReturnValue({ id: "private-draft" });
    const transaction = setupTransaction(
      draftData({ presentation, draftRevision: 1 }),
    );
    mocks.doc
      .mockReturnValueOnce({ id: "private-draft" })
      .mockReturnValueOnce({ id: "publication-auto" })
      .mockReturnValueOnce({ id: "version-auto" })
      .mockReturnValueOnce({ id: "pointer-mount" });

    // Emulates the StudioEditorMount onPublish contract:
    // onPublish = async () => { await repository.publishPresentation(presentation.id); }
    const onPublish = async () => {
      await repository.publishPresentation(presentation.id);
    };

    await onPublish();

    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.doc).toHaveBeenCalledWith(expect.anything(), "users", "user-1", "presentations", "pres-mount");
    expect(transaction.set).toHaveBeenCalledTimes(2);
  });
});
