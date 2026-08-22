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

function validContainer(
  id: string,
  children: unknown[],
): PowerShowElement {
  return {
    type: "container",
    id,
    hidden: false,
    direction: "column",
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

// ============================================================
// ANALYSIS
// ============================================================

describe("presentation recovery analysis", () => {
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
          // Legacy representation: no categories/items.
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
          direction: "column",
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