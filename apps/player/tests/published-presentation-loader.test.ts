import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
  getApps: vi.fn(),
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  initializeApp: mocks.initializeApp,
  getApp: mocks.getApp,
  getApps: mocks.getApps,
}));

vi.mock("firebase/firestore/lite", () => ({
  getFirestore: mocks.getFirestore,
  doc: mocks.doc,
  getDoc: mocks.getDoc,
}));

function validPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-1",
    title: "Published",
    description: "",
    aspectRatio: "16:9",
    slides: [
      { id: "slide-1", title: "", summary: "", speakerNotes: "", elements: [] },
    ],
  });
}

function canonicalContainerPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-container",
    title: "Canonical Container",
    description: "",
    aspectRatio: "16:9",
    slides: [
      {
        id: "slide-container",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [
          {
            id: "container-player",
            type: "container",
            hidden: false,
            layout: {
              width: "70%",
              height: "60%",
              position: "absolute",
              bottom: 20,
              right: 30,
              children: {
                direction: "column",
                gap: 8,
              },
            },
            style: {
              color: "#ffffff",
              background: {
                color: "#111827",
              },
              borderRadius: 10,
            },
            effect: {
              opacity: 0.85,
            },
            children: [
              {
                id: "player-child",
                type: "text",
                hidden: false,
                variant: "body",
                content: "Loaded canonical Container",
              },
            ],
          },
        ],
      },
    ],
  });
}

function pointerDoc(currentVersionId = "version-current") {
  return {
    exists: () => true,
    data: () => ({ currentVersionId, publishedRevision: 3, publishedAt: "ts" }),
  };
}

function versionDoc(presentation: unknown) {
  return {
    exists: () => true,
    data: () => ({
      presentationId:
        typeof presentation === "object" && presentation !== null && "id" in presentation
          ? (presentation as { id: string }).id
          : undefined,
      presentationJson:
        typeof presentation === "string"
          ? presentation
          : JSON.stringify(presentation),
    }),
  };
}

function setViteEnv(present: boolean) {
  const keys = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
  ] as const;

  for (const key of keys) {
    vi.stubEnv(key, present ? "set" : "");
  }
}

function defaultAppMocks() {
  mocks.initializeApp.mockReturnValue({ name: "fresh" });
  mocks.getApps.mockReturnValue([]);
  mocks.getFirestore.mockReturnValue({});
  return { initializeApp: mocks.initializeApp, getApps: mocks.getApps };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("published presentation loader via pointer", () => {
  it("resolves ok when the pointer and version both exist with a valid presentation", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc
      .mockReturnValueOnce({ id: "pointer-ref" })
      .mockReturnValueOnce({ id: "version-ref" });
    mocks.getDoc
      .mockResolvedValueOnce(pointerDoc("version-current"))
      .mockResolvedValueOnce(versionDoc(validPresentation()));

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedPresentation("publication-1");

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.presentation.id).toBe("pres-1");
    }
    expect(mocks.doc).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "publishedPresentations",
      "publication-1",
    );
    expect(mocks.doc).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "publishedPresentations",
      "publication-1",
      "versions",
      "version-current",
    );
  });

  it("returns not-found when the pointer does not exist", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc.mockReturnValueOnce({ id: "pointer-ref" });
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedPresentation("publication-1");

    expect(result).toEqual({ kind: "not-found" });
    // Second doc for version must NOT be called.
    expect(mocks.doc).toHaveBeenCalledTimes(1);
  });

  it("returns error for a malformed pointer (missing, empty, or non-string currentVersionId)", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc.mockReturnValueOnce({ id: "pointer-ref" });

    for (const data of [
      {},
      { currentVersionId: "" },
      { currentVersionId: "   " },
      { currentVersionId: 42 },
    ]) {
      vi.clearAllMocks();
      defaultAppMocks();
      mocks.doc.mockReturnValueOnce({ id: "pointer-ref" });
      mocks.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => data,
      });

      const { loadPublishedPresentation: reload } =
        await import("../src/published-presentation-loader");
      const result = await reload("publication-1");

      expect(result).toEqual({ kind: "error" });
    }
  });

  it("returns not-found when the referenced version does not exist", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc
      .mockReturnValueOnce({ id: "pointer-ref" })
      .mockReturnValueOnce({ id: "version-ref" });
    mocks.getDoc
      .mockResolvedValueOnce(pointerDoc("version-current"))
      .mockResolvedValueOnce({ exists: () => false });

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedPresentation("publication-1");

    expect(result).toEqual({ kind: "not-found" });
  });

  it("rejects a malformed presentation with error", async () => {
    setViteEnv(true);
    defaultAppMocks();

    mocks.doc
      .mockReturnValueOnce({ id: "pointer-ref" })
      .mockReturnValueOnce({ id: "version-ref" });
    mocks.getDoc
      .mockResolvedValueOnce(pointerDoc("version-current"))
      .mockResolvedValueOnce(versionDoc({ schemaVersion: 999, slides: [] }));

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedPresentation("publication-1");

    expect(result).toEqual({ kind: "error" });
  });

  it("returns error without rejecting when getDoc rejects", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc.mockReturnValueOnce({ id: "pointer-ref" });
    mocks.getDoc.mockRejectedValueOnce(new Error("permission denied"));

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedPresentation("publication-1");

    expect(result).toEqual({ kind: "error" });
  });

  it("returns error without rejecting when the version read rejects after a valid pointer", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc
      .mockReturnValueOnce({ id: "pointer-ref" })
      .mockReturnValueOnce({ id: "version-ref" });
    mocks.getDoc
      .mockResolvedValueOnce(pointerDoc("version-current"))
      .mockRejectedValueOnce(new Error("version read failed"));

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedPresentation("publication-1");

    expect(result).toEqual({ kind: "error" });
  });

  it("returns error without rejecting when Firebase initialization fails", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.initializeApp.mockImplementationOnce(() => {
      throw new Error("bad config");
    });

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedPresentation("publication-1");

    expect(result).toEqual({ kind: "error" });
  });

  it("reuses an existing Firebase app instead of initializing a new one", async () => {
    setViteEnv(true);
    const { getApps, initializeApp } = defaultAppMocks();
    getApps.mockReturnValue([{ name: "existing" }]);
    mocks.doc.mockReturnValueOnce({ id: "pointer-ref" });
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");
    await loadPublishedPresentation("publication-1");

    expect(initializeApp).not.toHaveBeenCalled();
    expect(mocks.getFirestore).toHaveBeenCalledWith({ name: "existing" });
  });

  it("loads a published presentation containing a canonical Container", async () => {
    setViteEnv(true);
    defaultAppMocks();

    const presentation = canonicalContainerPresentation();

    mocks.doc
      .mockReturnValueOnce({ id: "pointer-ref" })
      .mockReturnValueOnce({ id: "version-ref" });

    mocks.getDoc
      .mockResolvedValueOnce(pointerDoc("version-container"))
      .mockResolvedValueOnce(versionDoc(presentation));

    const { loadPublishedPresentation } =
      await import("../src/published-presentation-loader");

    const result = await loadPublishedPresentation("publication-container");

    expect(result.kind).toBe("ok");

    if (result.kind !== "ok") {
      throw new Error("Expected canonical published presentation to load.");
    }

    expect(result.presentation).toEqual(presentation);

    const container = result.presentation.slides[0]?.elements[0];

    expect(container?.type).toBe("container");

    if (container?.type !== "container") {
      throw new Error("Expected first element to be a Container.");
    }

    expect(container.layout).toMatchObject({
      width: "70%",
      height: "60%",
      position: "absolute",
      bottom: 20,
      right: 30,
      children: {
        direction: "column",
        gap: 8,
      },
    });

    expect(container.style).toMatchObject({
      color: "#ffffff",
      background: {
        color: "#111827",
      },
      borderRadius: 10,
    });

    expect(container.effect).toEqual({
      opacity: 0.85,
    });

    expect(container.children[0]).toMatchObject({
      id: "player-child",
      type: "text",
      content: "Loaded canonical Container",
    });

    expect(container).not.toHaveProperty("direction");
    expect(container).not.toHaveProperty("layoutMode");
    expect(container).not.toHaveProperty("style.width");
    expect(container).not.toHaveProperty("style.position");
    expect(container).not.toHaveProperty("style.opacity");
    expect(container).not.toHaveProperty("style.placement");

    expect(mocks.doc).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "publishedPresentations",
      "publication-container",
    );

    expect(mocks.doc).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "publishedPresentations",
      "publication-container",
      "versions",
      "version-container",
    );
  });
});

describe("published presentation loader by exact version", () => {
  it("loads the exact version directly without resolving the pointer", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc.mockReturnValueOnce({ id: "version-ref" });
    mocks.getDoc.mockResolvedValueOnce(versionDoc(validPresentation()));

    const { loadPublishedVersion } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedVersion("publication-1", "version-exact");

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.presentation.id).toBe("pres-1");
    }
    expect(mocks.doc).toHaveBeenCalledTimes(1);
    expect(mocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "publication-1",
      "versions",
      "version-exact",
    );
  });

  it("returns not-found when the exact version does not exist", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc.mockReturnValueOnce({ id: "version-ref" });
    mocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    const { loadPublishedVersion } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedVersion(
      "publication-1",
      "version-missing",
    );

    expect(result).toEqual({ kind: "not-found" });
  });

  it("returns error when the exact version is malformed", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc.mockReturnValueOnce({ id: "version-ref" });
    mocks.getDoc.mockResolvedValueOnce(
      versionDoc({ schemaVersion: 999, slides: [] }),
    );

    const { loadPublishedVersion } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedVersion("publication-1", "version-bad");

    expect(result).toEqual({ kind: "error" });
  });

  it("returns error when the published version identity mismatches its canonical payload", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc.mockReturnValueOnce({ id: "version-ref" });
    const presentation = validPresentation();
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        presentationId: "other-presentation",
        presentationJson: JSON.stringify(presentation),
      }),
    });

    const { loadPublishedVersion } =
      await import("../src/published-presentation-loader");
    await expect(loadPublishedVersion("publication-1", "version-exact"))
      .resolves.toEqual({ kind: "error" });
  });

  it("returns error without rejecting when the exact version read fails", async () => {
    setViteEnv(true);
    defaultAppMocks();
    mocks.doc.mockReturnValueOnce({ id: "version-ref" });
    mocks.getDoc.mockRejectedValueOnce(new Error("version read failed"));

    const { loadPublishedVersion } =
      await import("../src/published-presentation-loader");
    const result = await loadPublishedVersion("publication-1", "version-exact");

    expect(result).toEqual({ kind: "error" });
  });
});
