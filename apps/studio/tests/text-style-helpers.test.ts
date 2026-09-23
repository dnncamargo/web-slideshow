import { describe, expect, it } from "vitest";
import { PresentationSchema, SYSTEM_TABLE_CELL_TEXT_STYLE_ID, SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID, SYSTEM_TOPICS_TEXT_STYLE_ID } from "@web-slideshow/document-schema";
import { addCustomTextStyle, areTextStyleDefinitionsEqualForAuthoring, areTextStyleOwnedPropertyValuesEqual, createTextStyleId, ensureStructuredTableTextStyles, ensureTopicsTextStyle, findTextStyleUsageLocations, isTextStyleUsed, listPresentationTextStyles, propagateTextStyleDefinitionChanges, removeUnusedCustomTextStyle, resetFundamentalTextStyleOverride, updateCustomTextStyle, upsertFundamentalTextStyleOverride } from "../src/features/editor/text-style-helpers";

const base = () => PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "", elements: [] }] });

function textElement() {
  return { id: "quote-text", type: "text" as const, hidden: false, variant: "quote", content: "x" };
}

const nestedUsageCases = [
  ["Container", { id: "container", type: "container", hidden: false, children: [textElement()] }],
  ["Topics", { id: "topics", type: "topics", hidden: false, kind: "unordered", items: [{ id: "topic", content: { id: "topic-content", children: [textElement()] }, children: [] }] }],
  ["structured Table", { id: "table", type: "table", mode: "structured", hidden: false, showHeader: true, columns: [{ id: "column", header: { id: "header", children: [textElement()] } }], rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }] }],
] as const;

describe("presentation typography style authoring", () => {
  it("projects all virtual fundamentals before custom styles", () => {
    const presentation = addCustomTextStyle(base(), "Quote", "body");
    const projected = listPresentationTextStyles(presentation);
    expect(projected.map((item) => item.id)).toEqual(["title", "subtitle", "body", "caption", "quote"]);
    expect(listPresentationTextStyles(base()).slice(0, 4).every((item) => item.style === undefined)).toBe(true);
    expect(listPresentationTextStyles(upsertFundamentalTextStyleOverride(base(), "body", { fontFamily: "Inter" }))[2]?.style).toMatchObject({ id: "body" });
  });

  it("normalizes and resets fundamental overrides", () => {
    const body = upsertFundamentalTextStyleOverride(base(), "body", { fontFamily: "Inter", fontSize: undefined });
    expect(body.textStyles).toEqual([{ id: "body", typography: { fontFamily: "Inter" } }]);
    expect(resetFundamentalTextStyleOverride(body, "body")).not.toHaveProperty("textStyles");
    expect(upsertFundamentalTextStyleOverride(base(), "body", { fontFamily: undefined })).not.toHaveProperty("textStyles");
  });

  it("persists and sparsely clears layout-only fundamental overrides", () => {
    const withLayout = upsertFundamentalTextStyleOverride(base(), "body", { layout: { marginTop: 10 } });
    expect(withLayout.textStyles).toEqual([{ id: "body", layout: { marginTop: 10 } }]);
    const withOtherBags = upsertFundamentalTextStyleOverride(withLayout, "body", { typography: { fontWeight: 500 }, style: { color: "#123456" } });
    const clearedLayout = upsertFundamentalTextStyleOverride(withOtherBags, "body", { layout: { marginTop: undefined } });
    expect(clearedLayout.textStyles).toEqual([{ id: "body", style: { color: "#123456" }, typography: { fontWeight: 500 } }]);
    expect(upsertFundamentalTextStyleOverride(clearedLayout, "body", { typography: { fontWeight: undefined }, style: { color: undefined } })).not.toHaveProperty("textStyles");
  });

  it("allocates quote, quote-2, and quote-3 while reserving fundamental IDs", () => {
    let presentation = base();
    for (const expectedId of ["quote", "quote-2", "quote-3"]) {
      presentation = addCustomTextStyle(presentation, "Quote", "body");
      expect(presentation.textStyles?.at(-1)?.id).toBe(expectedId);
    }
    expect(createTextStyleId("Body", [])).toBe("body-2");
    expect(createTextStyleId("Title", [])).toBe("title-2");
  });

  it("uses reserved Structured Table IDs without adding styles to a new presentation", () => {
    expect(base()).not.toHaveProperty("textStyles");
    expect(SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID).toBe("system:table-column-header");
    expect(SYSTEM_TABLE_CELL_TEXT_STYLE_ID).toBe("system:table-cell");
    expect(createTextStyleId("arbitrary:table-column-header", [])).not.toBe(SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID);
    expect(createTextStyleId("arbitrary:table-cell", [])).not.toBe(SYSTEM_TABLE_CELL_TEXT_STYLE_ID);
  });

  it("ensures canonical Table styles by ID and preserves same-name and renamed styles", () => {
    const sameName = addCustomTextStyle(base(), "Column header", "body");
    const prepared = ensureStructuredTableTextStyles(sameName);
    expect(prepared.presentation.textStyles).toEqual([
      { id: "column-header", name: "Column header", role: "body" },
      { id: SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID, name: "Column header", role: "body" },
      { id: SYSTEM_TABLE_CELL_TEXT_STYLE_ID, name: "Table cell", role: "body" },
    ]);

    const renamed = updateCustomTextStyle(prepared.presentation, SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID, { name: "My headers" });
    const reused = ensureStructuredTableTextStyles(renamed);
    expect(reused.presentation).toEqual(renamed);
    expect(reused.ids.columnHeader).toBe(SYSTEM_TABLE_COLUMN_HEADER_TEXT_STYLE_ID);
  });

  it("lazily ensures one canonical Topics style by ID", () => {
    const sameName = addCustomTextStyle(base(), "Topics", "body");
    const prepared = ensureTopicsTextStyle(sameName);

    expect(prepared.textStyles).toEqual([
      { id: "topics", name: "Topics", role: "body" },
      { id: SYSTEM_TOPICS_TEXT_STYLE_ID, name: "Topics", role: "body" },
    ]);
    expect(ensureTopicsTextStyle(prepared)).toBe(prepared);
    expect(SYSTEM_TOPICS_TEXT_STYLE_ID).toBe("system:topics");
  });

  it("preserves IDs when editing and validates custom style creation", () => {
    const created = addCustomTextStyle(base(), "Quote", "body");
    expect(created.textStyles?.[0]).toEqual({ id: "quote", name: "Quote", role: "body" });
    expect(updateCustomTextStyle(created, "quote", { name: "Block Quote", role: "caption" }).textStyles?.[0]).toMatchObject({ id: "quote", name: "Block Quote", role: "caption" });
    expect(addCustomTextStyle(base(), "   ", "body")).toEqual(base());
    expect(updateCustomTextStyle(created, "quote", { name: "   ", role: "caption" }).textStyles?.[0]).toMatchObject({ id: "quote", name: "Quote", role: "caption" });
  });

  it("clears the last custom typography property without removing identity", () => {
    const created = addCustomTextStyle(base(), "Quote", "body");
    const styled = updateCustomTextStyle(created, "quote", { typography: { fontFamily: "Inter" } });
    expect(styled.textStyles?.[0]).toEqual({ id: "quote", name: "Quote", role: "body", typography: { fontFamily: "Inter" } });

    const renamed = updateCustomTextStyle(styled, "quote", { name: "Block Quote" });
    expect(renamed.textStyles?.[0]).toEqual({ id: "quote", name: "Block Quote", role: "body", typography: { fontFamily: "Inter" } });

    const cleared = updateCustomTextStyle(renamed, "quote", { typography: { fontFamily: undefined } });
    expect(cleared.textStyles?.[0]).toEqual({ id: "quote", name: "Block Quote", role: "body" });
    expect(cleared.textStyles?.[0]).not.toHaveProperty("typography");
    expect(PresentationSchema.safeParse(cleared).success).toBe(true);
  });

  it("updates custom layout without reconstructing identity or unrelated bags", () => {
    const created = addCustomTextStyle(base(), "Quote", "body");
    const styled = updateCustomTextStyle(created, "quote", { style: { color: "#123456" }, typography: { fontWeight: 500 }, layout: { marginTop: 10, marginBottom: 20 } });
    expect(styled.textStyles?.[0]).toEqual({ id: "quote", name: "Quote", role: "body", style: { color: "#123456" }, typography: { fontWeight: 500 }, layout: { marginTop: 10, marginBottom: 20 } });
    const cleared = updateCustomTextStyle(styled, "quote", { layout: { marginTop: undefined, marginBottom: 20 } });
    expect(cleared.textStyles?.[0]).toEqual({ id: "quote", name: "Quote", role: "body", style: { color: "#123456" }, typography: { fontWeight: 500 }, layout: { marginBottom: 20 } });
    const lastCleared = updateCustomTextStyle(cleared, "quote", { layout: { marginBottom: undefined } });
    expect(lastCleared.textStyles?.[0]).toEqual({ id: "quote", name: "Quote", role: "body", style: { color: "#123456" }, typography: { fontWeight: 500 } });
  });

  it.each(nestedUsageCases)("detects a used style in a nested %s", (_label, nestedElement) => {
    const presentation = PresentationSchema.parse({
      ...addCustomTextStyle(base(), "Quote", "body"),
      slides: [{ id: "s", title: "", elements: [nestedElement] }],
    });
    expect(isTextStyleUsed(presentation, "quote")).toBe(true);
  });

  it("excludes detached root and Topics text while retaining attached usage", () => {
    const detachedTopicText = { ...textElement(), id: "detached-topic", variant: "body", styleDetached: true as const };
    const attachedTopicText = { ...textElement(), id: "attached-topic", variant: "body" };
    const presentation = PresentationSchema.parse({
      ...addCustomTextStyle(base(), "Quote", "body"),
      slides: [{ id: "s", title: "", elements: [
        { id: "detached-root", type: "text", hidden: false, variant: "body", styleDetached: true, content: "local" },
        { id: "topics", type: "topics", hidden: false, kind: "unordered", items: [{ id: "item", content: { id: "slot", children: [detachedTopicText, attachedTopicText] }, children: [] }] },
      ] }],
    });
    expect(findTextStyleUsageLocations(presentation, "body")).toEqual([{ target: { kind: "slide", slideIndex: 0 }, elementId: "attached-topic" }]);
    expect(isTextStyleUsed(presentation, "body")).toBe(true);
    const onlyDetached = PresentationSchema.parse({ ...presentation, slides: [{ ...presentation.slides[0]!, elements: [detachedTopicText] }] });
    expect(findTextStyleUsageLocations(onlyDetached, "body")).toEqual([]);
    expect(isTextStyleUsed(onlyDetached, "body")).toBe(false);
  });

  it("blocks fundamentals from removal and removes unused custom styles", () => {
    const created = addCustomTextStyle(base(), "Quote", "body");
    expect(removeUnusedCustomTextStyle(upsertFundamentalTextStyleOverride(created, "body", { fontFamily: "Inter" }), "body")).toBeNull();
    expect(removeUnusedCustomTextStyle(created, "quote")).not.toBeNull();
  });

  it("blocks used styles from removal without changing the text element", () => {
    const created = addCustomTextStyle(base(), "Quote", "body");
    const used = PresentationSchema.parse({ ...created, slides: [{ id: "s", title: "", elements: [textElement()] }] });
    expect(isTextStyleUsed(used, "quote")).toBe(true);
    expect(removeUnusedCustomTextStyle(used, "quote")).toBeNull();
    expect(used.slides[0]?.elements[0]).toMatchObject({ type: "text", variant: "quote", content: "x" });
  });

  it.each([
    ["Root Definition", { id: "root-text", type: "text", hidden: false, variant: "quote", content: "root" }],
    ["local Root child", { id: "local-text", type: "text", hidden: false, variant: "quote", content: "local" }],
  ] as const)("treats a custom style used only by a %s as in use", (_label, usedElement) => {
    const created = addCustomTextStyle(base(), "Quote", "body");
    const presentation = PresentationSchema.parse({
      ...created,
      rootDefinitions: [{
        id: "root-definition",
        name: "Root Definition",
        localChildTargetIds: ["root-container"],
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: _label === "Root Definition" ? [usedElement] : [],
        },
      }],
      defaultRootDefinitionId: "root-definition",
      slides: [{
        id: "slide",
        title: "",
        elements: [],
        rootDefinitionId: "root-definition",
        ...(_label === "local Root child" ? {
          localRootChildren: [{ targetContainerId: "root-container", children: [usedElement] }],
        } : {}),
      }],
    });

    expect(isTextStyleUsed(presentation, "quote")).toBe(true);
    expect(removeUnusedCustomTextStyle(presentation, "quote")).toBeNull();
  });

  it("keeps detached Root Definition text outside the current usage semantics", () => {
    const created = addCustomTextStyle(base(), "Quote", "body");
    const presentation = PresentationSchema.parse({
      ...created,
      rootDefinitions: [{
        id: "root-definition",
        name: "Root Definition",
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: [{ ...textElement(), variant: "body", styleDetached: true }],
        },
      }],
      defaultRootDefinitionId: "root-definition",
      slides: [{ id: "slide", title: "", elements: [], rootDefinitionId: "root-definition" }],
    });

    expect(isTextStyleUsed(presentation, "body")).toBe(false);
  });

  it("projects every matching text element in canonical slide and hierarchy order", () => {
    const first = textElement();
    const second = { ...textElement(), id: "nested-quote" };
    const presentation = PresentationSchema.parse({
      ...addCustomTextStyle(base(), "Quote", "body"),
      slides: [
        { id: "s1", title: "", elements: [first, { id: "container", type: "container", hidden: false, children: [second] }] },
        { id: "s2", title: "", elements: [{ id: "other", type: "text", hidden: false, variant: "body", content: "other" }] },
      ],
    });
    expect(findTextStyleUsageLocations(presentation, "quote")).toEqual([
      { target: { kind: "slide", slideIndex: 0 }, elementId: "quote-text" },
      { target: { kind: "slide", slideIndex: 0 }, elementId: "nested-quote" },
    ]);
    expect(isTextStyleUsed(presentation, "quote")).toBe(true);
    expect(findTextStyleUsageLocations(presentation, "caption")).toEqual([]);
  });

  it("projects matching Text Style usage from a canonical Root Definition", () => {
    const presentation = PresentationSchema.parse({
      ...addCustomTextStyle(base(), "Quote", "body"),
      slides: [{ id: "s", title: "", elements: [{ id: "slide-quote", type: "text", hidden: false, variant: "quote", content: "Slide" }] }],
      rootDefinitions: [{
        id: "root-1",
        name: "Teaching master",
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: [{ id: "root-quote", type: "text", hidden: false, variant: "quote", content: "Root" }],
        },
      }],
    });

    expect(findTextStyleUsageLocations(presentation, "quote")).toEqual([
      { target: { kind: "slide", slideIndex: 0 }, elementId: "slide-quote" },
      { target: { kind: "root-definition", rootDefinitionId: "root-1" }, elementId: "root-quote" },
    ]);
  });

  it("propagates only changed owned properties across attached nested text", () => {
    const before = {
      id: "body" as const,
      typography: {
        fontSize: 20,
        textAlign: "center" as const,
        textStroke: { width: 3, color: "#0000ff" },
      },
      style: { color: "#ff0000" },
      layout: { marginTop: 30, marginRight: 12 },
    };
    const after = {
      id: "body" as const,
      typography: {
        fontSize: 24,
        textAlign: "center" as const,
        textStroke: { width: 2, color: "#00ff00" },
      },
      style: { color: "#0000ff" },
      layout: { marginTop: 40, marginRight: 12 },
    };
    const richContent = { type: "rich-text" as const, runs: [{ text: "Keep", marks: { bold: true } }] };
    const presentation = PresentationSchema.parse({
      ...base(),
      textStyles: [after, { id: "quote", name: "Quote", role: "body", typography: { fontSize: 10 } }],
      slides: [{
        id: "s",
        title: "",
        elements: [
          {
            id: "attached",
            type: "text",
            hidden: false,
            variant: "body",
            content: richContent,
            typography: { fontSize: 30, textAlign: "right", textStroke: { width: 0, color: "#0000ff" } },
            style: { color: "#ff0000", background: { color: "#ffff00" }, border: { width: 1, style: "solid", color: "#000000" }, borderRadius: 4, className: "keep" },
            layout: { margin: 8, marginTop: 50, marginRight: 12, marginBottom: 10, marginLeft: 11, position: "absolute", top: 20 },
          },
          {
            id: "nested",
            type: "container",
            hidden: false,
            children: [{ id: "nested-text", type: "text", hidden: false, variant: "body", content: "Nested", typography: { fontSize: 31 } }],
          },
          { id: "other-style", type: "text", hidden: false, variant: "quote", content: "Other", typography: { fontSize: 50 } },
          { id: "detached", type: "text", hidden: false, variant: "body", styleDetached: true, content: "Detached", typography: { fontSize: 60 } },
        ],
      }],
    });

    const propagated = propagateTextStyleDefinitionChanges(presentation, "body", before, after);
    const slide = propagated.slides[0]!;
    const attached = slide.elements[0]!;
    const nested = (slide.elements[1] as Extract<typeof slide.elements[number], { type: "container" }>).children[0]!;

    expect(attached).toMatchObject({
      typography: { textAlign: "right" },
      style: { background: { color: "#ffff00" }, border: { width: 1, style: "solid", color: "#000000" }, borderRadius: 4, className: "keep" },
      layout: { margin: 8, marginRight: 12, marginBottom: 10, marginLeft: 11, position: "absolute", top: 20 },
      content: richContent,
    });
    expect(attached).not.toHaveProperty("typography.fontSize");
    expect(attached).not.toHaveProperty("typography.textStroke");
    expect(attached).not.toHaveProperty("style.color");
    expect(attached).not.toHaveProperty("layout.marginTop");
    expect(nested).not.toHaveProperty("typography.fontSize");
    expect(slide.elements[2]).toEqual(presentation.slides[0]!.elements[2]);
    expect(slide.elements[3]).toEqual(presentation.slides[0]!.elements[3]);
  });

  it("treats add, remove, width-zero stroke, and semantic no-op as property-level changes", () => {
    const before = { id: "body" as const, typography: { fontSize: 20, textStroke: { width: 3, color: "#0000ff" } }, layout: { marginTop: 10 } };
    const attached = { id: "text", type: "text" as const, hidden: false, variant: "body", content: "Text", typography: { fontSize: 30, textStroke: { width: 0, color: "#0000ff" }, fontWeight: 700 }, layout: { marginTop: 20, marginLeft: 4 } };
    const basePresentation = PresentationSchema.parse({ ...base(), textStyles: [before], slides: [{ id: "s", title: "", elements: [attached] }] });

    const noOp = { id: "body" as const, typography: { fontSize: 20, textStroke: { width: 3, color: "#0000ff" } }, layout: { marginTop: 10 } };
    expect(areTextStyleDefinitionsEqualForAuthoring(before, noOp)).toBe(true);
    expect(propagateTextStyleDefinitionChanges(basePresentation, "body", before, noOp)).toBe(basePresentation);
    expect(areTextStyleOwnedPropertyValuesEqual({ scope: "typography", property: "textStroke" }, { width: 3, color: { kind: "palette", colorId: "primary" } }, { width: 3, color: { kind: "palette", colorId: "primary" } })).toBe(true);

    const added = { id: "body" as const, typography: { fontSize: 24, textStroke: { width: 3, color: "#0000ff" } }, layout: { marginTop: 30 } };
    const addedPresentation = propagateTextStyleDefinitionChanges(basePresentation, "body", before, added);
    expect(addedPresentation.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(addedPresentation.slides[0]!.elements[0]).not.toHaveProperty("layout.marginTop");

    const removed = { id: "body" as const, typography: {}, layout: { marginTop: 10 } };
    const removedCandidate = PresentationSchema.parse({ ...basePresentation, textStyles: [{ id: "body", layout: { marginTop: 10 } }] });
    const removedPresentation = propagateTextStyleDefinitionChanges(removedCandidate, "body", before, removed);
    expect(removedPresentation.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
    expect(removedPresentation.slides[0]!.elements[0]).not.toHaveProperty("typography.textStroke");
    expect(removedPresentation.slides[0]!.elements[0]).toMatchObject({ typography: { fontWeight: 700 }, layout: { marginTop: 20, marginLeft: 4 } });
  });

  it("propagates custom property removal but not rename or role changes", () => {
    const withStyle = PresentationSchema.parse({
      ...addCustomTextStyle(base(), "Quote", "body"),
      textStyles: [{ id: "quote", name: "Quote", role: "body", typography: { fontSize: 20, textAlign: "center" }, style: { color: "#ff0000" } }],
      slides: [{ id: "s", title: "", elements: [{ id: "quote-text", type: "text", hidden: false, variant: "quote", content: "Quote", typography: { fontSize: 30, textAlign: "right" }, style: { color: "#0000ff" } }] }],
    });
    const before = withStyle.textStyles![0]!;
    const renamed = updateCustomTextStyle(withStyle, "quote", { name: "Renamed", role: "caption" });
    expect(propagateTextStyleDefinitionChanges(renamed, "quote", before, renamed.textStyles![0])).toBe(renamed);
    const removed = updateCustomTextStyle(withStyle, "quote", { typography: { fontSize: undefined, textAlign: "center" } });
    const propagated = propagateTextStyleDefinitionChanges(removed, "quote", before, removed.textStyles![0]);
    expect(propagated.slides[0]!.elements[0]).toMatchObject({ typography: { textAlign: "right" }, style: { color: "#0000ff" } });
    expect(propagated.slides[0]!.elements[0]).not.toHaveProperty("typography.fontSize");
  });
});
