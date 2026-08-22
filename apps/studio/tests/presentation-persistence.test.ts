import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import {
  assertPresentationWithinFirestoreNestingDepth,
  assertPresentationWithinSizeLimit,
  estimateFirestoreNestingDepth,
  estimatePresentationBytes,
  extractPresentationSummary,
  makeFirestoreSafePresentation,
  MAX_PRESENTATION_SAFE_BYTES,
  MAX_FIRESTORE_NESTING_DEPTH,
  parsePersistedPresentation,
} from "../src/features/persistence/presentation-persistence";
import {
  appendElementToContainer,
  createElement,
} from "../src/features/editor/element-operations";
import {
  PresentationTooDeepError,
  PresentationTooLargeError,
  InvalidPersistedPresentationError,
} from "../src/features/persistence/persistence-errors";

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

function buildNestedObject(depth: number): unknown {
  let value: unknown = "leaf";

  for (let index = 0; index < depth; index += 1) {
    value = { child: value };
  }

  return value;
}

describe("presentation persistence helpers", () => {
  it("treats scalars as depth 0", () => {
    expect(estimateFirestoreNestingDepth("leaf")).toBe(0);
  });

  it("treats a root object as depth 1", () => {
    expect(estimateFirestoreNestingDepth({ title: "Leaf" })).toBe(1);
  });

  it("increments depth for nested objects", () => {
    expect(estimateFirestoreNestingDepth({ child: { grandchild: true } })).toBe(2);
  });

  it("increments depth for arrays", () => {
    expect(estimateFirestoreNestingDepth([["leaf"]])).toBe(2);
  });

  it("counts object nesting inside arrays correctly", () => {
    expect(estimateFirestoreNestingDepth([{ child: "leaf" }])).toBe(2);
  });

  it("uses the deepest path rather than sibling count", () => {
    expect(
      estimateFirestoreNestingDepth({
        shallowA: { label: "a" },
        shallowB: { label: "b" },
        deep: { child: { grandchild: { leaf: true } } },
      }),
    ).toBe(4);
  });

  it("accepts the configured nesting depth of 20", () => {
    const value = buildNestedObject(MAX_FIRESTORE_NESTING_DEPTH);

    expect(() => assertPresentationWithinFirestoreNestingDepth(value)).not.toThrow();
    expect(estimateFirestoreNestingDepth(value)).toBe(MAX_FIRESTORE_NESTING_DEPTH);
  });

  it("throws PresentationTooDeepError above the configured depth", () => {
    const value = buildNestedObject(MAX_FIRESTORE_NESTING_DEPTH + 1);

    expect(() => assertPresentationWithinFirestoreNestingDepth(value)).toThrow(
      PresentationTooDeepError,
    );
  });

  it("does not mutate the measured value", () => {
    const value = {
      slides: [
        {
          id: "slide-1",
          elements: [{ children: [{ nested: "value" }] }],
        },
      ],
    };
    const original = structuredClone(value);

    expect(estimateFirestoreNestingDepth(value)).toBe(7);
    expect(value).toEqual(original);
  });

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
    try {
      parsePersistedPresentation({
        presentation: { schemaVersion: 999, slides: [] },
      });
      throw new Error("expected persisted presentation parsing to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPersistedPresentationError);
      expect((error as InvalidPersistedPresentationError).cause).toBeDefined();
      expect((error as InvalidPersistedPresentationError).message).toMatch(
        /not a valid PowerShow document/,
      );
    }
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
      archivedAt: null,
      folderId: null,
      publicationState: "draft",
      draftRevision: 0,
      publication: undefined,
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

describe("persistence round trip with an Embed", () => {
  it("preserves a nested Embed created and inserted through Studio authoring", () => {
    const presentation = basePresentation();
    const container = createElement("container", []) as Extract<Presentation["slides"][number]["elements"][number], { type: "container" }>;
    const embed = createElement("embed", []);

    presentation.slides = [
      {
        id: "slide-1",
        title: "Embed slide",
        summary: "",
        speakerNotes: "",
        elements: appendElementToContainer([container], container.id, embed),
      },
    ];

    const parsed = PresentationSchema.parse(presentation);

    const safe = makeFirestoreSafePresentation(parsed);

    const recovered = parsePersistedPresentation({ presentation: safe });

    const recoveredContainer = recovered.slides[0]?.elements[0];

    expect(recoveredContainer?.type).toBe("container");

    if (recoveredContainer?.type === "container") {
      const recoveredEmbed = recoveredContainer.children[0];

      expect(recoveredEmbed).toMatchObject({
        id: embed.id,
        type: "embed",
        src: "https://example.com/",
        title: "Embedded content",
        hidden: false,
        style: {
          width: "60%",
          height: "55%",
        },
      });
    }
  });
});

describe("persistence round trip with Blocks", () => {
  it("round-trips a nested Blocks tree preserving ids, text, style, and nesting", () => {
    const presentation = basePresentation();

    presentation.slides = [
      {
        id: "slide-1",
        title: "Blocks slide",
        summary: "",
        speakerNotes: "",
        elements: [
          {
            id: "blocks-1",
            type: "blocks",
            hidden: false,
            style: {
              width: "60%",
              background: "#0f172a",
            },
            items: [
              {
                id: "root-a",
                text: "Root A",
                children: [
                  {
                    id: "child-a1",
                    text: "Child A1",
                    children: [
                      {
                        id: "grand-a1a",
                        text: "Grand A1a",
                        children: [],
                      },
                    ],
                  },
                ],
              },
              {
                id: "root-b",
                text: "Root B",
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const parsed = PresentationSchema.parse(presentation);

    const safe = makeFirestoreSafePresentation(parsed);

    const recovered = parsePersistedPresentation({ presentation: safe });

    const blocks = recovered.slides[0]?.elements[0];

    expect(blocks?.type).toBe("blocks");

    if (blocks?.type === "blocks") {
      expect(blocks).toMatchObject({
        id: "blocks-1",
        type: "blocks",
        hidden: false,
        style: {
          width: "60%",
          background: "#0f172a",
        },
      });

      expect(blocks.items).toEqual([
        {
          id: "root-a",
          text: "Root A",
          children: [
            {
              id: "child-a1",
              text: "Child A1",
              children: [
                {
                  id: "grand-a1a",
                  text: "Grand A1a",
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "root-b",
          text: "Root B",
          children: [],
        },
      ]);
    }
  });
});
