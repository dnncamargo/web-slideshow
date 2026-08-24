import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  onSnapshot: mocks.onSnapshot,
}));

vi.mock("../src/features/persistence/firebase-client", () => ({
  getFirebaseFirestore: mocks.getFirebaseFirestore,
}));

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { FirestorePublishedPresentationReader } from "../src/features/persistence/firestore-published-presentation-reader";
import { PresentationSchema } from "@powershow/document-schema";

const reader = new FirestorePublishedPresentationReader();

function versionData(
  presentation: unknown,
  overrides: Record<string, unknown> = {},
) {
  return {
    presentation,
    publishedRevision: 3,
    publishedAt: "published",
    ...overrides,
  };
}

function snapshot(exists: boolean, data: unknown) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

describe("published presentation reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFirebaseFirestore.mockReturnValue({});
    mocks.doc.mockImplementation((...path: unknown[]) => ({ path }));
    mocks.onSnapshot.mockReturnValue(vi.fn());
  });

  it("observes the public pointer and returns the Firestore unsubscribe", () => {
    const onPointer = vi.fn();
    const unsubscribe = vi.fn();
    mocks.onSnapshot.mockReturnValue(unsubscribe);

    const cleanup = reader.subscribePointer(
      "publication-1",
      onPointer,
      vi.fn(),
    );

    expect(mocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "publication-1",
    );

    const handler = mocks.onSnapshot.mock.calls[0]?.[1] as (
      value: ReturnType<typeof snapshot>,
    ) => void;
    handler(
      snapshot(true, {
        currentVersionId: " version-9 ",
        publishedRevision: 7,
        publishedAt: "ignored-by-domain-boundary",
      }),
    );

    expect(onPointer).toHaveBeenCalledWith({
      currentVersionId: "version-9",
      publishedRevision: 7,
    });

    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("reports a missing pointer as null", () => {
    const onPointer = vi.fn();
    reader.subscribePointer("publication-1", onPointer, vi.fn());

    const handler = mocks.onSnapshot.mock.calls[0]?.[1] as (
      value: ReturnType<typeof snapshot>,
    ) => void;
    handler(snapshot(false, null));

    expect(onPointer).toHaveBeenCalledWith(null);
  });

  it.each([
    null,
    {},
    { currentVersionId: "", publishedRevision: 1 },
    { currentVersionId: "version-1", publishedRevision: -1 },
    { currentVersionId: "version-1", publishedRevision: 1.5 },
  ])("reports a malformed pointer through onError", (value) => {
    const onPointer = vi.fn();
    const onError = vi.fn();
    reader.subscribePointer("publication-1", onPointer, onError);

    const handler = mocks.onSnapshot.mock.calls[0]?.[1] as (
      valueSnapshot: ReturnType<typeof snapshot>,
    ) => void;
    handler(snapshot(true, value));

    expect(onPointer).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("reports Firestore listener errors through onError", () => {
    const onError = vi.fn();
    reader.subscribePointer("publication-1", vi.fn(), onError);

    const errorHandler = mocks.onSnapshot.mock.calls[0]?.[2] as (
      error: unknown,
    ) => void;
    const cause = new Error("permission denied");
    errorHandler(cause);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("returns the canonical Presentation for a valid published version", async () => {
    const presentation = createBlankPresentation("pres-1");
    mocks.getDoc.mockResolvedValue(snapshot(true, versionData(presentation)));

    const result = await reader.getVersion("publication-1", "version-9");

    expect(result).toEqual(presentation);
  });

  it("returns a canonical Container unchanged from a published version", async () => {
    const presentation = PresentationSchema.parse({
      ...createBlankPresentation("pres-1"),
      slides: [
        {
          id: "slide-canonical-container",
          title: "",
          summary: "",
          speakerNotes: "",
          elements: [
            {
              id: "container-reader",
              type: "container",
              hidden: false,
              layout: {
                width: "75%",
                position: "absolute",
                top: 10,
                right: 20,
                children: {
                  mode: "stack",
                  direction: "row",
                },
              },
              style: {
                background: {
                  color: "#112233",
                },
              },
              effect: {
                opacity: 0.8,
              },
              children: [
                {
                  id: "reader-text",
                  type: "text",
                  hidden: false,
                  variant: "body",
                  content: "Canonical reader child",
                },
              ],
            },
          ],
        },
      ],
    });

    mocks.getDoc.mockResolvedValue(snapshot(true, versionData(presentation)));

    const result = await reader.getVersion(
      "publication-1",
      "version-canonical",
    );

    expect(result).not.toBeNull();

    const container = result?.slides[0]?.elements[0];

    expect(container).toEqual(presentation.slides[0]?.elements[0]);

    expect(container).toMatchObject({
      id: "container-reader",
      type: "container",
      layout: {
        width: "75%",
        position: "absolute",
        top: 10,
        right: 20,
        children: {
          mode: "stack",
          direction: "row",
        },
      },
      style: {
        background: {
          color: "#112233",
        },
      },
      effect: {
        opacity: 0.8,
      },
    });

    expect(container).not.toHaveProperty("direction");
    expect(container).not.toHaveProperty("layoutMode");
    expect(container).not.toHaveProperty("style.width");
    expect(container).not.toHaveProperty("style.position");
    expect(container).not.toHaveProperty("style.opacity");
    expect(container).not.toHaveProperty("style.placement");

    expect(mocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "publication-1",
      "versions",
      "version-canonical",
    );
  });

  it("returns Scripted source and authored style exactly from a valid published version", async () => {
    const html = "<article>\n  <em>reader exact</em>\n</article>\n";
    const css = ".reader {\n  letter-spacing:  0.1em;\n}\n";
    const script = 'const readerValue = "  exact  ";\nvoid readerValue;\n';
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
              id: "scripted-reader",
              type: "scripted",
              hidden: false,
              title: "Reader exact source",
              html,
              css,
              script,
              style: { width: "68%", height: "52%", opacity: 0.9 },
            },
          ],
        },
      ],
    });
    mocks.getDoc.mockResolvedValue(snapshot(true, versionData(presentation)));

    const result = await reader.getVersion("publication-1", "version-9");

    expect(result?.slides[0]?.elements[0]).toEqual({
      id: "scripted-reader",
      type: "scripted",
      hidden: false,
      title: "Reader exact source",
      html,
      css,
      script,
      style: { width: "68%", height: "52%", opacity: 0.9 },
    });
  });

  it("returns null when the version document does not exist", async () => {
    mocks.getDoc.mockResolvedValue(snapshot(false, null));

    const result = await reader.getVersion("publication-1", "version-9");

    expect(result).toBeNull();
  });

  it("does not return malformed published data as a valid Presentation", async () => {
    mocks.getDoc.mockResolvedValue(
      snapshot(true, versionData({ id: "invalid", slides: "not-an-array" })),
    );

    await expect(
      reader.getVersion("publication-1", "version-9"),
    ).rejects.toThrow();
  });

  it("does not return a non-object version document as a Presentation", async () => {
    mocks.getDoc.mockResolvedValue(snapshot(true, "not-an-object"));

    await expect(
      reader.getVersion("publication-1", "version-9"),
    ).rejects.toThrow();
  });

  it("addresses the exact publicationId and versionId path", async () => {
    mocks.getDoc.mockResolvedValue(
      snapshot(true, versionData(createBlankPresentation("pres-1"))),
    );

    await reader.getVersion("publication-abc", "version-123");

    expect(mocks.doc).toHaveBeenCalledWith(
      expect.anything(),
      "publishedPresentations",
      "publication-abc",
      "versions",
      "version-123",
    );
  });
});
