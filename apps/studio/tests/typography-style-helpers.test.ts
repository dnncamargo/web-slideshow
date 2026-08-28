import { describe, expect, it } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
import { addCustomTypographyStyle, createTypographyStyleId, isTypographyStyleUsed, listPresentationTypographyStyles, removeUnusedCustomTypographyStyle, resetFundamentalTypographyOverride, updateCustomTypographyStyle, upsertFundamentalTypographyOverride } from "../src/features/editor/typography-style-helpers";

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
    const presentation = addCustomTypographyStyle(base(), "Quote", "body");
    const projected = listPresentationTypographyStyles(presentation);
    expect(projected.map((item) => item.id)).toEqual(["title", "subtitle", "body", "caption", "quote"]);
    expect(listPresentationTypographyStyles(base()).slice(0, 4).every((item) => item.style === undefined)).toBe(true);
    expect(listPresentationTypographyStyles(upsertFundamentalTypographyOverride(base(), "body", { fontFamily: "Inter" }))[2]?.style).toMatchObject({ id: "body" });
  });

  it("normalizes and resets fundamental overrides", () => {
    const body = upsertFundamentalTypographyOverride(base(), "body", { fontFamily: "Inter", fontSize: undefined });
    expect(body.typographyStyles).toEqual([{ id: "body", typography: { fontFamily: "Inter" } }]);
    expect(resetFundamentalTypographyOverride(body, "body")).not.toHaveProperty("typographyStyles");
    expect(upsertFundamentalTypographyOverride(base(), "body", { fontFamily: undefined })).not.toHaveProperty("typographyStyles");
  });

  it("allocates quote, quote-2, and quote-3 while reserving fundamental IDs", () => {
    let presentation = base();
    for (const expectedId of ["quote", "quote-2", "quote-3"]) {
      presentation = addCustomTypographyStyle(presentation, "Quote", "body");
      expect(presentation.typographyStyles?.at(-1)?.id).toBe(expectedId);
    }
    expect(createTypographyStyleId("Body", [])).toBe("body-2");
    expect(createTypographyStyleId("Title", [])).toBe("title-2");
  });

  it("preserves IDs when editing and validates custom style creation", () => {
    const created = addCustomTypographyStyle(base(), "Quote", "body");
    expect(created.typographyStyles?.[0]).toMatchObject({ id: "quote", typography: {} });
    expect(updateCustomTypographyStyle(created, "quote", { name: "Block Quote", role: "caption" }).typographyStyles?.[0]).toMatchObject({ id: "quote", name: "Block Quote", role: "caption" });
    expect(addCustomTypographyStyle(base(), "   ", "body")).toEqual(base());
    expect(updateCustomTypographyStyle(created, "quote", { name: "   ", role: "caption" }).typographyStyles?.[0]).toMatchObject({ id: "quote", name: "Quote", role: "caption" });
  });

  it.each(nestedUsageCases)("detects a used style in a nested %s", (_label, nestedElement) => {
    const presentation = PresentationSchema.parse({
      ...addCustomTypographyStyle(base(), "Quote", "body"),
      slides: [{ id: "s", title: "", elements: [nestedElement] }],
    });
    expect(isTypographyStyleUsed(presentation, "quote")).toBe(true);
  });

  it("blocks fundamentals from removal and removes unused custom styles", () => {
    const created = addCustomTypographyStyle(base(), "Quote", "body");
    expect(removeUnusedCustomTypographyStyle(upsertFundamentalTypographyOverride(created, "body", { fontFamily: "Inter" }), "body")).toBeNull();
    expect(removeUnusedCustomTypographyStyle(created, "quote")).not.toBeNull();
  });

  it("blocks used styles from removal without changing the text element", () => {
    const created = addCustomTypographyStyle(base(), "Quote", "body");
    const used = PresentationSchema.parse({ ...created, slides: [{ id: "s", title: "", elements: [textElement()] }] });
    expect(isTypographyStyleUsed(used, "quote")).toBe(true);
    expect(removeUnusedCustomTypographyStyle(used, "quote")).toBeNull();
    expect(used.slides[0]?.elements[0]).toMatchObject({ type: "text", variant: "quote", content: "x" });
  });
});
