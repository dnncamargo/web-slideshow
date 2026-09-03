import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type PowerShowElement,
} from "@powershow/document-schema";

import {
  analyzePresentationRecovery,
  RECOVERY_REASON,
} from "../src/features/persistence/presentation-recovery";

// ============================================================
// FIXTURES
// ============================================================

function validText(id: string, text = "Hello"): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content: text,
  };
}

/** A text element with an invalid `content` (number instead of string). */
function invalidText(id: string): unknown {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content: 42,
  };
}

function validImage(id: string): PowerShowElement {
  return {
    type: "image",
    id,
    hidden: false,
    src: "/img.png",
    alt: "alt",
    fit: "cover",
  };
}

function validScripted(id: string): PowerShowElement {
  return {
    type: "scripted",
    id,
    hidden: true,
    title: "Recovery exact source",
    html: '<div data-value="  exact  ">\n  keep\n</div>\n',
    css: ".recovery {\n  gap:  4px;\n}\n",
    script: 'const recovery = "  exact  ";\nvoid recovery;\n',
    layout: { width: "66%", height: "48%" },
    style: { className: "recovery-scripted" },
  };
}

function invalidScripted(id: string): unknown {
  return {
    type: "scripted",
    id,
    hidden: false,
    title: "",
    html: "<div>invalid</div>",
    css: "",
    script: "",
  };
}

function validContainer(
  id: string,
  children: unknown[],
): PowerShowElement {
  return {
    type: "container",
    id,
    hidden: false,
    children: children as PowerShowElement[],
  };
}

function validSlide(id: string, elements: unknown[] = []): unknown {
  return {
    id,
    title: "",
    summary: "",
    speakerNotes: "",
    elements,
  };
}

function rawWithSlides(slides: unknown[]): unknown {
  return {
    schemaVersion: 1,
    id: "pres-raw",
    title: "Recovery",
    description: "",
    aspectRatio: "16:9",
    slides,
  };
}

function rawWithTextStyles(
  slides: unknown[],
  textStyles: unknown[],
): unknown {
  const base = rawWithSlides(slides);
  return {
    ...(base as Record<string, unknown>),
    textStyles,
  };
}

function quoteStyle(): unknown {
  return {
    id: "quote",
    name: "Quote",
    role: "body",
    typography: { fontStyle: "italic" },
  };
}

function customText(id: string, typography?: unknown, variant = "quote"): unknown {
  return {
    type: "text",
    id,
    hidden: false,
    variant,
    content: id,
    ...(typography === undefined ? {} : { typography }),
  };
}

// ============================================================
// ANALYSIS
// ============================================================

describe("presentation recovery analysis", () => {
  it("removes obsolete typographyStyles without migrating it", () => {
    const raw = {
      ...(rawWithSlides([validSlide("slide-1", [
        validText("fundamental"),
        customText("obsolete-custom"),
        validImage("unrelated"),
      ])] as unknown[]) as Record<string, unknown>),
      typographyStyles: [quoteStyle()],
    };

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation).not.toBeNull();
    expect(analysis.presentation).not.toHaveProperty("typographyStyles");
    expect(analysis.presentation).not.toHaveProperty("textStyles");
    expect(analysis.presentation?.slides[0]?.elements.map((element) => element.id)).toEqual([
      "fundamental",
      "unrelated",
    ]);
    expect(analysis.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "text-style",
        path: ["typographyStyles"],
        reason: RECOVERY_REASON.obsoleteTextStyleContent,
      }),
      expect.objectContaining({ id: "obsolete-custom", kind: "element" }),
    ]));
    expect(PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("removes incompatible current Text Styles while preserving valid styles and siblings", () => {
    const analysis = analyzePresentationRecovery(rawWithTextStyles(
      [validSlide("slide-1", [
        validText("fundamental"),
        customText("valid-custom"),
        customText("invalid-custom", undefined, "broken"),
        validImage("unrelated"),
      ])],
      [quoteStyle(), { id: "broken", name: "Broken", role: "body", style: { color: "invalid" } }],
    ));

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.textStyles?.map((style) => style.id)).toEqual(["quote"]);
    expect(analysis.presentation?.slides[0]?.elements.map((element) => element.id)).toEqual([
      "fundamental",
      "valid-custom",
      "unrelated",
    ]);
    expect(analysis.issues).toContainEqual(expect.objectContaining({
      kind: "text-style",
      id: "broken",
      path: ["textStyles", 1],
      reason: RECOVERY_REASON.invalidTextStyle,
    }));
    expect(PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("removes an invalid fundamental override while preserving fundamental Text", () => {
    const analysis = analyzePresentationRecovery({
      ...(rawWithTextStyles(
        [validSlide("slide-1", [validText("fundamental")])],
        [{ id: "body", style: { color: { kind: "palette", colorId: "missing" } } }],
      ) as Record<string, unknown>),
      palette: { colors: [] },
    });

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.textStyles).toEqual([]);
    expect(analysis.presentation?.slides[0]?.elements.map((element) => element.id)).toEqual([
      "fundamental",
    ]);
    expect(analysis.issues).toContainEqual(expect.objectContaining({
      kind: "text-style",
      id: "body",
      reason: RECOVERY_REASON.invalidTextStyle,
    }));
    expect(PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("removes a custom Text Style with an unresolved Palette reference and nested dependents", () => {
    const analysis = analyzePresentationRecovery({
      ...(rawWithTextStyles(
        [validSlide("slide-1", [validContainer("container", [
          validText("fundamental"),
          customText("nested-custom", undefined, "palette-broken"),
        ])])],
        [{
          id: "palette-broken",
          name: "Palette broken",
          role: "body",
          style: { color: { kind: "palette", colorId: "missing" } },
        }],
      ) as Record<string, unknown>),
      palette: { colors: [] },
    });

    expect(analysis.status).toBe("recoverable");
    const container = analysis.presentation?.slides[0]?.elements[0];
    expect(container?.type).toBe("container");
    if (container?.type === "container") {
      expect(container.children.map((element) => element.id)).toEqual(["fundamental"]);
    }
    expect(analysis.presentation?.textStyles).toEqual([]);
    expect(PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("removes a wrong-type textStyles field without synthesizing it", () => {
    const analysis = analyzePresentationRecovery({
      ...(rawWithSlides([validSlide("slide-1", [validText("kept")])]) as Record<string, unknown>),
      textStyles: {},
    });

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation).not.toHaveProperty("textStyles");
    expect(analysis.presentation?.slides[0]?.elements.map((element) => element.id)).toEqual(["kept"]);
    expect(analysis.issues).toContainEqual(expect.objectContaining({
      kind: "text-style",
      path: ["textStyles"],
      reason: RECOVERY_REASON.invalidTextStyle,
    }));
    expect(PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("keeps valid custom typography variants and returns a canonical presentation", () => {
    const analysis = analyzePresentationRecovery(rawWithTextStyles(
      [validSlide("slide-1", [customText("quote-text")])],
      [quoteStyle()],
    ));

    expect(analysis.status).toBe("valid");
    expect(analysis.presentation && PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("removes unresolved custom Text while preserving valid siblings", () => {
    const analysis = analyzePresentationRecovery(rawWithSlides([
      validSlide("slide-1", [validText("kept"), customText("missing")]),
    ]));

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((element) => element.id)).toEqual(["kept"]);
    expect(analysis.issues).toContainEqual(expect.objectContaining({ id: "missing", reason: RECOVERY_REASON.invalidElement }));
    expect(analysis.presentation && PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("prunes unresolved nested custom Text without removing its Container", () => {
    const analysis = analyzePresentationRecovery(rawWithSlides([
      validSlide("slide-1", [validContainer("container", [validText("kept"), customText("missing")])]),
    ]));

    const container = analysis.presentation?.slides[0]?.elements[0];
    expect(container?.type).toBe("container");
    if (container?.type === "container") {
      expect(container.children.map((element) => element.id)).toEqual(["kept"]);
    }
  });

  it("preserves custom Text with local V1 typography and element-only typography", () => {
    const analysis = analyzePresentationRecovery(rawWithTextStyles([
      validSlide("slide-1", [
        customText("bad", { fontFamily: "Arial" }),
        customText("stroke", { textStroke: { width: 1, color: "#fff" } }),
        customText("decoration", { textDecorationColor: "#fff" }),
        validText("independent", "Independent"),
      ]),
    ], [quoteStyle()]));

    const elements = analysis.presentation?.slides[0]?.elements;
    expect(elements?.map((element) => element.id)).toEqual(["bad", "stroke", "decoration", "independent"]);
    expect(analysis.issues).not.toContainEqual(expect.objectContaining({ id: "bad", reason: RECOVERY_REASON.invalidElement }));
    expect(analysis.presentation && PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("prunes unresolved custom Text from canonical Topics content", () => {
    const topics = {
      id: "topics-typography",
      type: "topics",
      hidden: false,
      kind: "unordered",
      items: [{
        id: "topic-1",
        content: {
          id: "topic-slot-1",
          children: [validText("topic-kept"), customText("topic-missing", undefined, "missing-topic-style")],
        },
        children: [],
      }],
    };
    const analysis = analyzePresentationRecovery(rawWithTextStyles(
      [validSlide("slide-1", [topics])],
      [quoteStyle()],
    ));

    expect(analysis.status).toBe("recoverable");
    const recovered = analysis.presentation?.slides[0]?.elements[0];
    expect(recovered?.type).toBe("topics");
    if (recovered?.type === "topics") {
      expect(recovered.items[0]?.content.children.map((element) => element.id)).toEqual(["topic-kept"]);
    }
    expect(analysis.presentation && PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("prunes unresolved custom Text from a structured Table content slot", () => {
    const table = {
      id: "table-typography",
      type: "table",
      mode: "structured",
      showHeader: true,
      hidden: false,
      columns: [{
        id: "column-1",
        header: {
          id: "header-1",
          children: [validText("header-kept"), customText("header-missing", undefined, "missing-header-style")],
        },
      }],
      rows: [{
        id: "row-1",
        cells: [{ id: "cell-1", children: [validText("cell-kept")] }],
      }],
    };
    const analysis = analyzePresentationRecovery(rawWithTextStyles(
      [validSlide("slide-1", [table])],
      [quoteStyle()],
    ));

    expect(analysis.status).toBe("recoverable");
    const recovered = analysis.presentation?.slides[0]?.elements[0];
    expect(recovered?.type).toBe("table");
    if (recovered?.type === "table" && recovered.mode === "structured") {
      expect(recovered.columns[0]?.header.children.map((element) => element.id)).toEqual(["header-kept"]);
      expect(recovered.rows[0]?.cells[0]?.children.map((element) => element.id)).toEqual(["cell-kept"]);
    }
    expect(analysis.presentation && PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("preserves a fundamental attached Text with a local override", () => {
    const analysis = analyzePresentationRecovery(rawWithTextStyles(
      [validSlide("slide-1", [{
        type: "text",
        id: "independent",
        hidden: false,
        variant: "body",
        content: "Independent",
        typography: { fontFamily: "Fira Code" },
      }])],
      [{ id: "body", typography: { fontFamily: "Inter" } }],
    ));

    expect(analysis.status).toBe("valid");
    const recovered = analysis.presentation?.slides[0]?.elements[0];
    expect(recovered).toMatchObject({ variant: "body", typography: { fontFamily: "Fira Code" } });
    expect(analysis.presentation && PresentationSchema.safeParse(analysis.presentation).success).toBe(true);
  });

  it("classifies a valid presentation as valid with no issues", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [validText("text-1")]),
      validSlide("slide-2"),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("valid");
    expect(analysis.presentation).not.toBeNull();
    expect(analysis.issues).toEqual([]);
  });

  it("classifies valid Scripted content as valid without rewriting it", () => {
    const scripted = validScripted("scripted-valid");
    const raw = rawWithSlides([validSlide("slide-1", [scripted])]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("valid");
    expect(analysis.issues).toEqual([]);
    expect(analysis.presentation?.slides[0]?.elements[0]).toEqual(scripted);
  });

  it("removes an invalid Scripted element through the generic invalid-element path", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [validText("kept"), invalidScripted("scripted-invalid")]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((element) => element.id)).toEqual(["kept"]);
    expect(analysis.issues).toHaveLength(1);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      id: "scripted-invalid",
      elementType: "scripted",
      action: "remove",
      reason: RECOVERY_REASON.invalidElement,
    });
  });

  it("removes a nested invalid Scripted child while preserving its Container", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        validContainer("container-1", [validText("kept"), invalidScripted("scripted-invalid")]),
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    const container = analysis.presentation?.slides[0]?.elements[0];
    expect(container?.type).toBe("container");
    if (container?.type === "container") {
      expect(container.children.map((element) => element.id)).toEqual(["kept"]);
    }
    expect(analysis.issues[0]).toMatchObject({
      path: ["slides", 0, "elements", 0, "children", 1],
      id: "scripted-invalid",
      reason: RECOVERY_REASON.invalidElement,
    });
  });

  it("classifies an invalid root structure as unrecoverable", () => {
    // Missing required title: the root shell must fail.
    const raw = { schemaVersion: 1, id: "pres-x", slides: [] };

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("unrecoverable");
    expect(analysis.presentation).toBeNull();
    expect(analysis.issues).toHaveLength(1);
    expect(analysis.issues[0]?.path).toEqual([]);
    expect(analysis.issues[0]?.reason).toBe(
      RECOVERY_REASON.invalidPresentationStructure,
    );
  });

  it("classifies a non-object persisted presentation as unrecoverable", () => {
    const analysis = analyzePresentationRecovery(null);

    expect(analysis.status).toBe("unrecoverable");
    expect(analysis.presentation).toBeNull();
  });

  it("classifies a missing slides field as unrecoverable", () => {
    const raw = {
      schemaVersion: 1,
      id: "pres-x",
      title: "Recovery",
      description: "",
      aspectRatio: "16:9",
    };

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("unrecoverable");
    expect(analysis.presentation).toBeNull();
    expect(analysis.issues[0]?.reason).toBe(
      RECOVERY_REASON.invalidPresentationStructure,
    );
  });

  it("classifies a non-array slides string as unrecoverable", () => {
    const raw = {
      schemaVersion: 1,
      id: "pres-x",
      title: "Recovery",
      description: "",
      aspectRatio: "16:9",
      slides: "invalid",
    };

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("unrecoverable");
    expect(analysis.presentation).toBeNull();
    expect(analysis.issues[0]?.reason).toBe(
      RECOVERY_REASON.invalidPresentationStructure,
    );
  });

  it("classifies a non-array slides object as unrecoverable", () => {
    const raw = {
      schemaVersion: 1,
      id: "pres-x",
      title: "Recovery",
      description: "",
      aspectRatio: "16:9",
      slides: {},
    };

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("unrecoverable");
    expect(analysis.presentation).toBeNull();
    expect(analysis.issues[0]?.reason).toBe(
      RECOVERY_REASON.invalidPresentationStructure,
    );
  });

  it("removes an invalid leaf element while preserving its slide", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [validText("a"), invalidText("b")]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "a",
    ]);
    expect(analysis.issues).toHaveLength(1);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      path: ["slides", 0, "elements", 1],
      id: "b",
      elementType: "text",
      action: "remove",
    });
  });

  it("removes an invalid old Blocks element whole", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        validText("kept"),
        {
          id: "blocks-old",
          type: "blocks",
          hidden: false,
          // Incompatible legacy representation: no canonical items.
          blocks: [{ id: "b1", text: "old block" }],
        },
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "kept",
    ]);
    expect(analysis.issues).toHaveLength(1);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      elementType: "blocks",
      reason: RECOVERY_REASON.invalidBlocksElement,
    });
    expect(analysis.presentation).not.toBeNull();
    if (analysis.presentation) {
      expect(PresentationSchema.safeParse(analysis.presentation).success).toBe(
        true,
      );
    }
  });

  it("preserves valid sibling elements when an incompatible one is removed", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        validText("kept-a"),
        invalidText("bad"),
        validImage("kept-c"),
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "kept-a",
      "kept-c",
    ]);
  });

  it("recovers a structurally valid Container while removing an invalid child", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        validContainer("container-1", [validText("kept"), invalidText("bad")]),
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    const container = analysis.presentation?.slides[0]?.elements[0];
    expect(container?.type).toBe("container");
    if (container?.type === "container") {
      expect(container.children.map((e) => e.id)).toEqual(["kept"]);
    }
    expect(analysis.issues[0]?.path).toEqual([
      "slides",
      0,
      "elements",
      0,
      "children",
      1,
    ]);
  });

  it("removes a structurally invalid Container whole", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        // children is not an array → the container itself is removed.
        {
          type: "container",
          id: "container-broken",
          hidden: false,
          children: "not-an-array",
        },
        validText("after"),
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "after",
    ]);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      id: "container-broken",
      reason: RECOVERY_REASON.invalidContainerStructure,
    });
  });

  it("prunes invalid nested Topics content while preserving Topics structure", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        {
          id: "topics-1",
          type: "topics",
          kind: "unordered",
          hidden: false,
          items: [
            {
              id: "topic-a",
              content: {
                id: "slot-a",
                children: [validText("kept-topic"), invalidText("bad-topic")],
              },
              children: [
                {
                  id: "topic-a-1",
                  content: {
                    id: "slot-a-1",
                    children: [invalidText("bad-nested")],
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    const topics = analysis.presentation?.slides[0]?.elements[0];
    expect(topics?.type).toBe("topics");
    if (topics?.type === "topics") {
      const item = topics.items[0];
      expect(item?.content.children.map((e) => e.id)).toEqual(["kept-topic"]);
      expect(item?.children[0]?.content.children).toEqual([]);
    }
    expect(analysis.issues.map((issue) => issue.path)).toEqual([
      ["slides", 0, "elements", 0, "items", 0, "content", "children", 1],
      [
        "slides",
        0,
        "elements",
        0,
        "items",
        0,
        "children",
        0,
        "content",
        "children",
        0,
      ],
    ]);
  });

  it("removes a structurally invalid Topics element whole", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        {
          id: "topics-broken",
          type: "topics",
          kind: "unordered",
          hidden: false,
          // item missing required id → the structural shell fails.
          items: [{ content: { id: "slot", children: [] }, children: [] }],
        },
        validText("after"),
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "after",
    ]);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      id: "topics-broken",
      reason: RECOVERY_REASON.invalidTopicsStructure,
    });
  });

  it.each([
    ["TopicItem missing children", { children: undefined }],
    ["TopicItem children non-array", { children: "wrong" }],
    ["content missing", { content: undefined }],
    ["content.children missing", { content: { id: "slot" } }],
    ["content.children non-array", { content: { id: "slot", children: "wrong" } }],
  ])("removes the whole Topics element when %s", (_label, mutation) => {
    const topicItem = {
      id: "topic-a",
      content: { id: "slot-a", children: [validText("kept")] },
      children: [],
      ...mutation,
    };

    const raw = rawWithSlides([
      validSlide("slide-1", [
        {
          id: "topics-1",
          type: "topics",
          kind: "unordered",
          hidden: false,
          items: [topicItem],
        },
        validText("after"),
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "after",
    ]);
    expect(analysis.issues).toHaveLength(1);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      id: "topics-1",
      elementType: "topics",
      reason: RECOVERY_REASON.invalidTopicsStructure,
    });
  });

  it("removes the whole Topics element when a nested TopicItem lacks structure", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        {
          id: "topics-1",
          type: "topics",
          kind: "unordered",
          hidden: false,
          items: [
            {
              id: "topic-a",
              content: { id: "slot-a", children: [] },
              children: [
                {
                  id: "topic-nested",
                  content: { id: "slot-nested", children: [] },
                  // nested children must be an array
                  children: "wrong",
                },
              ],
            },
          ],
        },
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.presentation?.slides[0]?.elements).toEqual([]);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      id: "topics-1",
      reason: RECOVERY_REASON.invalidTopicsStructure,
    });
  });

  it("prunes invalid elements from structured table headers and cells", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        {
          id: "table-1",
          type: "table",
          mode: "structured",
          showHeader: true,
          hidden: false,
          columns: [
            {
              id: "col-1",
              header: {
                id: "header-1",
                children: [validText("header-kept"), invalidText("header-bad")],
              },
            },
          ],
          rows: [
            {
              id: "row-1",
              cells: [
                {
                  id: "cell-1",
                  children: [invalidText("cell-bad"), validText("cell-kept")],
                },
              ],
            },
          ],
        },
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    const table = analysis.presentation?.slides[0]?.elements[0];
    expect(table?.type).toBe("table");
    if (table?.type === "table" && table.mode === "structured") {
      expect(table.columns[0]?.header.children.map((e) => e.id)).toEqual([
        "header-kept",
      ]);
      expect(table.rows[0]?.cells[0]?.children.map((e) => e.id)).toEqual([
        "cell-kept",
      ]);
    }
  });

  it("removes a structurally invalid structured table whole", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        {
          id: "table-broken",
          type: "table",
          mode: "structured",
          showHeader: true,
          hidden: false,
          // One column but a row with two cells → structure invariant fails.
          columns: [
            {
              id: "col-1",
              header: { id: "header-1", children: [] },
            },
          ],
          rows: [
            {
              id: "row-1",
              cells: [
                { id: "cell-1", children: [] },
                { id: "cell-2", children: [] },
              ],
            },
          ],
        },
        validText("after"),
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "after",
    ]);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      id: "table-broken",
      reason: RECOVERY_REASON.invalidStructuredTable,
    });
  });

  it.each([
    ["columns missing", { columns: undefined }],
    ["columns non-array", { columns: "wrong" }],
    ["column not an object", { columns: ["wrong"] }],
    ["column.header missing", { columns: [{ id: "col-1" }] }],
    ["column.header not an object", { columns: [{ id: "col-1", header: "wrong" }] }],
    ["column.header.children missing", {
      columns: [{ id: "col-1", header: { id: "header-1" } }],
    }],
    ["column.header.children non-array", {
      columns: [{ id: "col-1", header: { id: "header-1", children: "wrong" } }],
    }],
    ["rows missing", { rows: undefined }],
    ["rows non-array", { rows: "wrong" }],
    ["row not an object", { rows: ["wrong"] }],
    ["row.cells missing", { rows: [{ id: "row-1" }] }],
    ["row.cells non-array", { rows: [{ id: "row-1", cells: "wrong" }] }],
    ["cell not an object", { rows: [{ id: "row-1", cells: ["wrong"] }] }],
    ["cell.children missing", {
      rows: [{ id: "row-1", cells: [{ id: "cell-1" }] }],
    }],
    ["cell.children non-array", {
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: "wrong" }] }],
    }],
  ])("removes the whole structured table when %s", (_label, mutation) => {
    const table = {
      id: "table-1",
      type: "table",
      mode: "structured",
      showHeader: true,
      hidden: false,
      columns: [
        {
          id: "col-1",
          header: { id: "header-1", children: [validText("header-kept")] },
        },
      ],
      rows: [
        {
          id: "row-1",
          cells: [{ id: "cell-1", children: [validText("cell-kept")] }],
        },
      ],
      ...mutation,
    };

    const raw = rawWithSlides([
      validSlide("slide-1", [table, validText("after")]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "after",
    ]);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      id: "table-1",
      elementType: "table",
      reason: RECOVERY_REASON.invalidStructuredTable,
    });
  });

  it("removes a structurally invalid simple table whole", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        {
          type: "table",
          id: "table-simple",
          hidden: false,
          // invalid columns value → simple table removed whole.
          columns: "bad",
          rows: [],
        },
        validText("after"),
      ]),
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides[0]?.elements.map((e) => e.id)).toEqual([
      "after",
    ]);
    expect(analysis.issues[0]).toMatchObject({
      kind: "element",
      id: "table-simple",
      reason: RECOVERY_REASON.invalidTable,
    });
  });

  it("removes an invalid slide whole when its structural shell fails", () => {
    const raw = rawWithSlides([
      validSlide("slide-ok", [validText("a")]),
      // elements present but slide id invalid → slide removed whole.
      { id: "", title: "", summary: "", speakerNotes: "", elements: [] },
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation?.slides.map((s) => s.id)).toEqual(["slide-ok"]);
    expect(analysis.issues[0]).toMatchObject({
      kind: "slide",
      path: ["slides", 1],
      action: "remove",
    });
  });

  it("reports deterministic issue paths with ids and types", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [
        validContainer("c-1", [invalidText("bad-leaf")]),
        { id: "no-type", hidden: false },
      ]),
      "not-a-slide-object",
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.issues.map((issue) => issue.path)).toEqual([
      ["slides", 0, "elements", 0, "children", 0],
      ["slides", 0, "elements", 1],
      ["slides", 1],
    ]);
    expect(analysis.issues[1]).toMatchObject({
      kind: "element",
      id: "no-type",
      action: "remove",
    });
    expect(analysis.issues[2]?.kind).toBe("slide");
    expect(analysis.issues[2]?.id).toBeUndefined();
  });

  it("never emits a candidate that fails final PresentationSchema validation", () => {
    const raw = rawWithSlides([
      validSlide("slide-1", [validText("a"), invalidText("b")]),
      validSlide("slide-2", [
        validContainer("c", [invalidText("nested")]),
      ]),
      "not-a-slide",
    ]);

    const analysis = analyzePresentationRecovery(raw);

    expect(analysis.status).toBe("recoverable");
    expect(analysis.presentation).not.toBeNull();
    if (analysis.presentation) {
      expect(PresentationSchema.safeParse(analysis.presentation).success).toBe(
        true,
      );
    }
  });

  it("keeps a fully valid presentation identity-stable through the fast path", () => {
    const presentation = rawWithSlides([
      validSlide("s-1", [validText("t-1")]),
    ]);

    const analysis = analyzePresentationRecovery(presentation);

    expect(analysis.status).toBe("valid");
    expect(analysis.presentation).toMatchObject({
      id: "pres-raw",
      title: "Recovery",
    });
    expect(analysis.issues).toHaveLength(0);
  });
});
