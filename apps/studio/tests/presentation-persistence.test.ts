import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import {
  assertPresentationWithinSizeLimit,
  estimatePresentationBytes,
  extractPresentationSummary,
  makeFirestoreSafePresentation,
  MAX_PRESENTATION_SAFE_BYTES,
  parsePersistedPresentation,
} from "../src/features/persistence/presentation-persistence";
import { PresentationTooLargeError } from "../src/features/persistence/persistence-errors";

function basePresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-1",
    title: "Test Presentation",
    description: "",
    aspectRatio: "16:9",
    slides: [],
  });
}

function buildLargePresentation(byteTarget: number): Presentation {
  const chunk = "x".repeat(1024);
  const presentation = basePresentation();

  while (estimatePresentationBytes(presentation) < byteTarget) {
    presentation.slides.push({
      id: `slide-${presentation.slides.length}`,
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [
        {
          type: "text",
          id: `text-${presentation.slides.length}`,
          hidden: false,
          variant: "body",
          content: chunk,
        },
      ],
    });
  }

  return presentation;
}

describe("presentation persistence helpers", () => {
  it("preserves a complete presentation through safe serialization", () => {
    const source = PresentationSchema.parse({
      schemaVersion: 1,
      id: "pres-complete",
      title: "Complete",
      description: "desc",
      aspectRatio: "16:9",
      resources: {
        fonts: [
          {
            id: "font-1",
            family: "Inter",
            faces: [
              {
                weight: 400,
                source: {
                  type: "url",
                  url: "https://example.test/inter.woff2",
                },
              },
            ],
          },
        ],
      },
      palette: { colors: ["#ffffff", "#000000"] },
      slides: [
        {
          id: "slide-1",
          title: "",
          summary: "",
          speakerNotes: "",
          elements: [
            {
              type: "container",
              id: "container-1",
              hidden: false,
              direction: "row",
              children: [
                {
                  type: "image",
                  id: "image-1",
                  hidden: false,
                  src: "/image.png",
                  alt: "alt",
                  fit: "cover",
                  focalPoint: { x: 25, y: 70 },
                },
              ],
            },
          ],
        },
      ],
    });
    const safe = makeFirestoreSafePresentation(source);

    expect(safe).toMatchObject({
      schemaVersion: 1,
      id: "pres-complete",
      title: "Complete",
    });
    expect(safe).toHaveProperty("resources");
    expect(safe).toHaveProperty("palette");
  });

  it("preserves slide and nested element order", () => {
    const source = basePresentation();
    source.slides = [
      { id: "a", title: "", summary: "", speakerNotes: "", elements: [] },
      {
        id: "b",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [
          {
            type: "container",
            id: "c",
            hidden: false,
            direction: "column",
            children: [
              { type: "text", id: "d", hidden: false, variant: "body", content: "x" },
              { type: "text", id: "e", hidden: false, variant: "body", content: "y" },
            ],
          },
        ],
      },
    ] as Presentation["slides"];

    const safe = makeFirestoreSafePresentation(source) as {
      slides: unknown[];
    };

    expect((safe.slides[0] as { id: string }).id).toBe("a");
    expect((safe.slides[1] as { id: string }).id).toBe("b");
  });

  it("omits undefined optional object fields and does not mutate the source", () => {
    const source = basePresentation();
    const original = structuredClone(source);

    const safe = makeFirestoreSafePresentation(source);

    expect("resources" in safe).toBe(false);
    expect("palette" in safe).toBe(false);
    expect(source).toEqual(original);
  });

  it("does not mix persistence metadata into the canonical presentation", () => {
    const source = basePresentation();
    const safe = makeFirestoreSafePresentation(source) as Record<string, unknown>;

    expect(safe).not.toHaveProperty("createdAt");
    expect(safe).not.toHaveProperty("updatedAt");
    expect(safe).not.toHaveProperty("archivedAt");
  });

  it("parses a valid persisted presentation", () => {
    const parsed = parsePersistedPresentation({
      presentation: basePresentation(),
      createdAt: null,
      updatedAt: null,
    });

    expect(parsed.id).toBe("pres-1");
  });

  it("rejects an invalid persisted presentation", () => {
    expect(() =>
      parsePersistedPresentation({
        presentation: { schemaVersion: 999, slides: [] },
      }),
    ).toThrow(/not a valid PowerShow document/);
  });

  it("returns deterministic UTF-8 byte counts", () => {
    const a = basePresentation();
    const b = basePresentation();

    expect(estimatePresentationBytes(a)).toBe(estimatePresentationBytes(b));
    expect(estimatePresentationBytes(a)).toBeGreaterThan(0);
  });

  it("passes presentations below the safety limit", () => {
    expect(() => assertPresentationWithinSizeLimit(basePresentation())).not.toThrow();
  });

  it("throws PresentationTooLargeError above the safety limit", () => {
    const large = buildLargePresentation(MAX_PRESENTATION_SAFE_BYTES + 100);

    expect(() => assertPresentationWithinSizeLimit(large)).toThrow(
      PresentationTooLargeError,
    );
  }, 15000);

  it("is deterministic at the configured safety boundary", () => {
    const presentation = basePresentation();
    const exactBytes = estimatePresentationBytes(presentation);

    expect(() =>
      assertPresentationWithinSizeLimit(presentation, exactBytes),
    ).not.toThrow();
    expect(() =>
      assertPresentationWithinSizeLimit(presentation, exactBytes - 1),
    ).toThrow(PresentationTooLargeError);
  });

  it("extracts only summary data", () => {
    const summary = extractPresentationSummary({
      id: "pres-1",
      title: "Title",
      updatedAt: "ts",
      archivedAt: null,
    });

    expect(summary).toEqual({
      id: "pres-1",
      title: "Title",
      updatedAt: "ts",
      archived: false,
    });
  });

  it("extracts archived state without altering the canonical presentation", () => {
    const source = basePresentation();

    expect(source).not.toHaveProperty("archivedAt");
    expect(
      extractPresentationSummary({
        id: source.id,
        title: source.title,
        updatedAt: "ts",
        archivedAt: "archive-time",
      }).archived,
    ).toBe(true);
  });
});
