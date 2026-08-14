import { afterEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({})),
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  initializeApp: mocks.initializeApp,
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
      {
        id: "slide-1",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [],
      },
    ],
  });
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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("published presentation loader", () => {
  it("resolves ok with a validated Presentation for a valid document", async () => {
    setViteEnv(true);
    mocks.doc.mockReturnValue({ id: "ref" });
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ presentation: validPresentation() }),
    });

    const { loadPublishedPresentation } = await import(
      "../src/published-presentation-loader"
    );
    const result = await loadPublishedPresentation("publication-1", "version-1");

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.presentation.id).toBe("pres-1");
    }
    expect(mocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "publication-1",
      "versions",
      "version-1",
    );
  });

  it("returns not-found for a missing document", async () => {
    setViteEnv(true);
    mocks.getDoc.mockResolvedValue({ exists: () => false });

    const { loadPublishedPresentation } = await import(
      "../src/published-presentation-loader"
    );
    const result = await loadPublishedPresentation("publication-1", "version-1");

    expect(result.kind).toBe("not-found");
  });

  it("rejects a malformed Presentation", async () => {
    setViteEnv(true);
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ presentation: { schemaVersion: 999, slides: [] } }),
    });

    const { loadPublishedPresentation } = await import(
      "../src/published-presentation-loader"
    );
    const result = await loadPublishedPresentation("publication-1", "version-1");

    expect(result.kind).toBe("error");
  });
});
