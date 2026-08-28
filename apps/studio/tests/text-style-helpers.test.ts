import { describe, expect, it } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
import { addCustomTextStyle, createTextStyleId, isTextStyleUsed, listPresentationTextStyles, removeUnusedCustomTextStyle, resetFundamentalTextStyleOverride, updateCustomTextStyle, upsertFundamentalTextStyleOverride } from "../src/features/editor/text-style-helpers";

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

  it("allocates quote, quote-2, and quote-3 while reserving fundamental IDs", () => {
    let presentation = base();
    for (const expectedId of ["quote", "quote-2", "quote-3"]) {
      presentation = addCustomTextStyle(presentation, "Quote", "body");
      expect(presentation.textStyles?.at(-1)?.id).toBe(expectedId);
    }
    expect(createTextStyleId("Body", [])).toBe("body-2");
    expect(createTextStyleId("Title", [])).toBe("title-2");
  });

  it("preserves IDs when editing and validates custom style creation", () => {
    const created = addCustomTextStyle(base(), "Quote", "body");
    expect(created.textStyles?.[0]).toEqual({ id: "quote", name: "Quote", role: "body" });
    expect(updateCustomTextStyle(created, "quote", { name: "Block Quote", role: "caption" }).textStyles?.[0]).toMatchObject({ id: "quote", name: "Block Quote", role: "caption" });
    expect(addCustomTextStyle(base(), "   ", "body")).toEqual(base());
    expect(updateCustomTextStyle(created, "quote", { name: "   ", role: "caption" }).textStyles?.[0]).toMatchObject({ id: "quote", name: "Quote", role: "caption" });
  });

  it.each(nestedUsageCases)("detects a used style in a nested %s", (_label, nestedElement) => {
    const presentation = PresentationSchema.parse({
      ...addCustomTextStyle(base(), "Quote", "body"),
      slides: [{ id: "s", title: "", elements: [nestedElement] }],
    });
    expect(isTextStyleUsed(presentation, "quote")).toBe(true);
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
});
