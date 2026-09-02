import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  getFirebaseFirestore: vi.fn(() => ({})),
  getCurrentNonAnonymousUser: vi.fn(() => ({
    uid: "user-1",
    isAnonymous: false,
  })),
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
import { PresentationSchema, type Presentation } from "@powershow/document-schema";
import { encodePresentationForFirestore } from "@powershow/firebase";

const repository = new FirestorePresentationRepository();

function draftData(overrides: Record<string, unknown> = {}) {
  const presentation = (overrides.presentation as Presentation | undefined) ?? createBlankPresentation("pres-1");
  const { presentation: _ignored, ...metadata } = overrides;

  return {
    ...encodePresentationForFirestore(presentation),
    draftRevision: 3,
    createdAt: "created",
    updatedAt: "updated",
    ...metadata,
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
    async (
      _firestore: unknown,
      callback: (value: typeof transaction) => unknown,
    ) => callback(transaction),
  );

  return transaction;
}

function canonicalContainerPresentation() {
  return PresentationSchema.parse({
    ...createBlankPresentation("pres-1"),
    slides: [
      {
        id: "slide-1",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [
          {
            id: "container-canonical",
            type: "container",
            hidden: false,
            layout: {
              width: "80%",
              padding: 16,
              position: "absolute",
              top: 24,
              left: 32,
              children: {
                direction: "column",
                gap: 12,
              },
            },
            style: {
              color: "#ffffff",
              background: {
                color: "#0f172a",
              },
              borderRadius: 12,
            },
            effect: {
              opacity: 0.9,
            },
            children: [
              {
                id: "text-child",
                type: "text",
                hidden: false,
                variant: "body",
                content: "Canonical child",
              },
            ],
          },
        ],
      },
    ],
  });
}

describe("transactional presentation publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFirebaseFirestore.mockReturnValue({});
    mocks.getCurrentNonAnonymousUser.mockReturnValue({
      uid: "user-1",
      isAnonymous: false,
    });
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
        presentationId: "pres-1",
        presentationJson: expect.any(String),
        publishedRevision: 3,
        publishedAt: "server-ts",
      }),
    );
    const versionPayload = transaction.set.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(versionPayload?.presentationId).toBe("pres-1");
    expect(typeof versionPayload?.presentationJson).toBe("string");
    expect(versionPayload).not.toHaveProperty("draftRevision");
    expect(versionPayload).not.toHaveProperty("createdAt");
    expect(versionPayload).not.toHaveProperty("updatedAt");
    expect(versionPayload).not.toHaveProperty("archivedAt");
    expect(versionPayload).not.toHaveProperty("publication");
    expect(versionPayload).not.toHaveProperty("publicationId");
    expect(versionPayload).not.toHaveProperty("presentation");
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
    const html =
      '<div data-value="  raw  ">\n  publish &amp; preserve\n</div>\n';
    const css = ".published {\n  padding:  4px;\n}\n";
    const script = 'const raw = "  publish  ";\nconsole.log(raw);\n';
    const presentation = PresentationSchema.parse({
      ...createBlankPresentation("pres-1"),
      slides: [
        {
          id: "slide-scripted",
          title: "",
          summary: "",
          speakerNotes: "",
          elements: [
            {
              id: "scripted-publish",
              type: "scripted",
              hidden: true,
              title: "Publish exact source",
              html,
              css,
              script,
              layout: {
                width: "71%",
                height: "41%",
              },
              style: {
                className: "published-scripted",
              },
            },
          ],
        },
      ],
    });
    const transaction = setupTransaction(draftData({ presentation }));
    mocks.doc
      .mockReturnValueOnce({ id: "private-draft" })
      .mockReturnValueOnce({ id: "publication-auto" })
      .mockReturnValueOnce({ id: "version-auto" })
      .mockReturnValueOnce({ id: "pointer-auto" });

    await repository.publishPresentation("pres-1");

    const versionPayload = transaction.set.mock.calls[0]?.[1] as {
      presentationJson: string;
    };
    const decoded = JSON.parse(versionPayload.presentationJson) as { slides: Array<{ elements: unknown[] }> };
    expect(decoded.slides[0]?.elements[0]).toEqual({
      id: "scripted-publish",
      type: "scripted",
      hidden: true,
      title: "Publish exact source",
      html,
      css,
      script,
      layout: { width: "71%", height: "41%" },
      style: { className: "published-scripted" },
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
    transaction = setupTransaction({
      presentation: { id: "invalid" },
      draftRevision: 1,
    });
    mocks.doc.mockReturnValueOnce({ id: "private-draft" });
    await expect(repository.publishPresentation("pres-1")).rejects.toThrow(
      "Persisted presentation is not a valid PowerShow document",
    );
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("copies the authoritative draft presentationJson bytes exactly", async () => {
    const presentation = createBlankPresentation("pres-1");
    const exactJson = `  ${JSON.stringify(presentation)}\n`;
    const transaction = setupTransaction(
      draftData({ presentationJson: exactJson }),
    );
    mocks.doc
      .mockReturnValueOnce({ id: "private-draft" })
      .mockReturnValueOnce({ id: "publication-exact" })
      .mockReturnValueOnce({ id: "version-exact" })
      .mockReturnValueOnce({ id: "pointer-exact" });

    await repository.publishPresentation("pres-1");

    expect(transaction.set.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        presentationId: "pres-1",
        presentationJson: exactJson,
      }),
    );
  });

  it("rejects publication when the draft canonical id differs from its path", async () => {
    const transaction = setupTransaction(
      draftData({ presentation: createBlankPresentation("other-presentation") }),
    );

    await expect(repository.publishPresentation("pres-1")).rejects.toThrow(
      /identity mismatch/i,
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
    expect(mocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "user-1",
      "presentations",
      "pres-mount",
    );
    expect(transaction.set).toHaveBeenCalledTimes(2);
  });

  it("publishes a canonical Container without rewriting its contract", async () => {
    const presentation = canonicalContainerPresentation();

    const transaction = setupTransaction(
      draftData({
        presentation,
      }),
    );

    mocks.doc
      .mockReturnValueOnce({ id: "private-draft" })
      .mockReturnValueOnce({ id: "publication-auto" })
      .mockReturnValueOnce({ id: "version-auto" })
      .mockReturnValueOnce({ id: "pointer-auto" });

    const result = await repository.publishPresentation("pres-1");

    expect(result).toEqual({
      publicationId: "publication-auto",
      versionId: "version-auto",
      publishedRevision: 3,
      createdVersion: true,
    });

    expect(transaction.get).toHaveBeenCalledWith({
      id: "private-draft",
    });

    expect(transaction.set).toHaveBeenCalledWith(
      { id: "version-auto" },
      expect.objectContaining({
        presentationId: presentation.id,
        presentationJson: JSON.stringify(presentation),
        publishedRevision: 3,
        publishedAt: "server-ts",
      }),
    );

    const versionPayload = transaction.set.mock.calls[0]?.[1] as {
      presentationJson?: string;
      publishedRevision?: number;
      publishedAt?: unknown;
    };

    const decoded = versionPayload.presentationJson === undefined
      ? undefined
      : JSON.parse(versionPayload.presentationJson) as { slides?: Array<{ elements?: unknown[] }> };
    const container = decoded?.slides?.[0]?.elements?.[0];

    expect(container).toMatchObject({
      id: "container-canonical",
      type: "container",
      hidden: false,
      layout: {
        width: "80%",
        padding: 16,
        position: "absolute",
        top: 24,
        left: 32,
        children: {
          direction: "column",
          gap: 12,
        },
      },
      style: {
        color: "#ffffff",
        background: {
          color: "#0f172a",
        },
        borderRadius: 12,
      },
      effect: {
        opacity: 0.9,
      },
      children: [
        {
          id: "text-child",
          type: "text",
          hidden: false,
          variant: "body",
          content: "Canonical child",
        },
      ],
    });

    expect(container).not.toHaveProperty("direction");
    expect(container).not.toHaveProperty("layoutMode");

    expect(container).not.toHaveProperty("style.width");
    expect(container).not.toHaveProperty("style.height");
    expect(container).not.toHaveProperty("style.padding");
    expect(container).not.toHaveProperty("style.position");
    expect(container).not.toHaveProperty("style.top");
    expect(container).not.toHaveProperty("style.left");

    expect(container).not.toHaveProperty("style.backgroundGradient");
    expect(container).not.toHaveProperty("style.backgroundPattern");
    expect(container).not.toHaveProperty("style.opacity");
    expect(container).not.toHaveProperty("style.shadow");
    expect(container).not.toHaveProperty("style.placement");

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
});
