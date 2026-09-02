import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";
import {
  encodePresentationForFirestore,
  MAX_PRESENTATION_SAFE_BYTES,
  PresentationTooLargeError,
} from "@powershow/firebase";

import {
  estimatePresentationBytes,
  extractPresentationSummary,
  parsePersistedPresentation,
} from "../src/features/persistence/presentation-persistence";
import {
  appendElementToContainer,
  createElement,
} from "../src/features/editor/element-operations";
import { InvalidPersistedPresentationError } from "../src/features/persistence/persistence-errors";

function makeFirestoreSafePresentation(presentation: Presentation): Record<string, unknown> {
  return JSON.parse(
    encodePresentationForFirestore(presentation).presentationJson,
  ) as Record<string, unknown>;
}

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

  while (presentation.slides.length < Math.ceil(byteTarget / 1024)) {
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
      palette: { colors: [
        { id: "#ffffff", name: "#ffffff", value: "#ffffff" },
        { id: "#000000", name: "#000000", value: "#000000" },
      ] },
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
              layout: {
                children: {
                  direction: "row",
                },
              },
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
            layout: {
              children: {
                direction: "row",
              },
            },
            children: [
              {
                type: "text",
                id: "d",
                hidden: false,
                variant: "body",
                content: "x",
              },
              {
                type: "text",
                id: "e",
                hidden: false,
                variant: "body",
                content: "y",
              },
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
    const safe = makeFirestoreSafePresentation(source) as Record<
      string,
      unknown
    >;

    expect(safe).not.toHaveProperty("createdAt");
    expect(safe).not.toHaveProperty("updatedAt");
    expect(safe).not.toHaveProperty("archivedAt");
  });

  it("parses a valid persisted presentation", () => {
    const parsed = parsePersistedPresentation({
      presentationJson: JSON.stringify(basePresentation()),
      createdAt: null,
      updatedAt: null,
    });

    expect(parsed.id).toBe("pres-1");
  });

  it("rejects an invalid persisted presentation", () => {
    try {
      parsePersistedPresentation({
        presentationJson: JSON.stringify({ schemaVersion: 999, slides: [] }),
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

  it("throws PresentationTooLargeError above the safety limit", () => {
    const large = buildLargePresentation(MAX_PRESENTATION_SAFE_BYTES + 100);

    expect(() => encodePresentationForFirestore(large)).toThrow(PresentationTooLargeError);
  }, 15000);

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
    const container = createElement("container", []) as Extract<
      Presentation["slides"][number]["elements"][number],
      { type: "container" }
    >;
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

    const recovered = parsePersistedPresentation({ presentationJson: JSON.stringify(safe) });

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
        layout: {
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
            layout: {
              width: "60%",
            },
            style: {
              background: { color: "#0f172a" },
            },
            items: [
              {
                id: "root-a",
                color: "#123456",
                shape: "scope",
                parts: [{ id: "root-p", type: "text", text: "repeat" }],
                children: [
                  {
                    id: "child-a1",
                    color: "#123456",
                    shape: "statement",
                    parts: [{ id: "child-p", type: "text", text: "move" }],
                    children: [],
                  },
                ],
              },
              {
                id: "root-b",
                color: "#654321",
                shape: "statement",
                parts: [{ id: "root-b-p", type: "text", text: "turn" }],
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const parsed = PresentationSchema.parse(presentation);

    const safe = makeFirestoreSafePresentation(parsed);

    const recovered = parsePersistedPresentation({ presentationJson: JSON.stringify(safe) });

    const blocks = recovered.slides[0]?.elements[0];

    expect(blocks?.type).toBe("blocks");

    if (blocks?.type === "blocks") {
      expect(blocks).toMatchObject({
        id: "blocks-1",
        type: "blocks",
        hidden: false,
        layout: { width: "60%" },
        style: { background: { color: "#0f172a" } },
      });

      expect(blocks.items.map((item) => item.color)).toEqual([
        "#123456",
        "#654321",
      ]);
      expect(blocks.items[0]?.parts[0]).toEqual({
        id: "root-p",
        type: "text",
        text: "repeat",
      });
      expect(blocks.items[0]?.children[0]?.id).toBe("child-a1");
    }
  });
});

describe("persistence round trip with Scripted", () => {
  it("preserves nested Scripted source and authored style exactly", () => {
    const html =
      '<section data-label="  exact  ">\n  <button>&amp; run</button>\n</section>\n';
    const css = '.stage {\n  white-space: pre;\n  content: "  keep  ";\n}\n';
    const script = 'const message = "  exact  ";\nconsole.log(message);\n';
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "pres-scripted",
      title: "Scripted persistence",
      description: "",
      aspectRatio: "16:9",
      slides: [
        {
          id: "slide-1",
          title: "",
          summary: "",
          speakerNotes: "",
          elements: [
            {
              id: "container-1",
              type: "container",
              hidden: false,
              children: [
                {
                  id: "scripted-1",
                  type: "scripted",
                  hidden: true,
                  title: "Exact scripted source",
                  html,
                  css,
                  script,
                  layout: {
                    width: "73%",
                    height: "44%",
                  },
                  style: {
                    className: "  authored  ",
                  },
                  effect: {
                    opacity: 0.8,
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const recovered = parsePersistedPresentation({
      presentationJson: JSON.stringify(makeFirestoreSafePresentation(presentation)),
    });
    const container = recovered.slides[0]?.elements[0];

    expect(container?.type).toBe("container");
    if (container?.type === "container") {
      expect(container.children[0]).toEqual({
        id: "scripted-1",
        type: "scripted",
        hidden: true,
        title: "Exact scripted source",
        html,
        css,
        script,
        layout: {
          width: "73%",
          height: "44%",
        },
        style: {
          className: "  authored  ",
        },
        effect: {
          opacity: 0.8,
        },
      });
    }
  });

  it("includes Scripted source in generic presentation byte accounting", () => {
    const presentation = basePresentation();
    const emptyBytes = estimatePresentationBytes(presentation);
    presentation.slides = [
      {
        id: "slide-1",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [
          {
            id: "scripted-bytes",
            type: "scripted",
            hidden: false,
            title: "Byte accounting",
            html: "<div>source</div>\n",
            css: ".source { color: teal; }\n",
            script: "console.log('source');\n",
          },
        ],
      },
    ];

    expect(estimatePresentationBytes(presentation)).toBeGreaterThan(emptyBytes);
  });
});
