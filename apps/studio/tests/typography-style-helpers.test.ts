import { describe, expect, it } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
import { addCustomTypographyStyle, createTypographyStyleId, isTypographyStyleUsed, listPresentationTypographyStyles, removeUnusedCustomTypographyStyle, resetFundamentalTypographyOverride, updateCustomTypographyStyle, upsertFundamentalTypographyOverride } from "../src/features/editor/typography-style-helpers";

const base = () => PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "", elements: [] }] });

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
  it("generates IDs and preserves them when editing", () => {
    expect(createTypographyStyleId("Héro Title", [])).toBe("hero-title");
    expect(createTypographyStyleId("Body", [])).toBe("body-2");
    const created = addCustomTypographyStyle(base(), "Quote", "body");
    expect(created.typographyStyles?.[0]).toMatchObject({ id: "quote", typography: {} });
    expect(updateCustomTypographyStyle(created, "quote", { name: "Block Quote", role: "caption" }).typographyStyles?.[0]).toMatchObject({ id: "quote", name: "Block Quote", role: "caption" });
    expect(addCustomTypographyStyle(base(), "   ", "body")).toEqual(base());
    expect(updateCustomTypographyStyle(created, "quote", { name: "   ", role: "caption" }).typographyStyles?.[0]).toMatchObject({ id: "quote", name: "Quote", role: "caption" });
  });
  it("blocks used styles and removes unused styles", () => {
    const created = addCustomTypographyStyle(base(), "Quote", "body");
    const used = PresentationSchema.parse({ ...created, slides: [{ id: "s", title: "", elements: [{ id: "t", type: "text", hidden: false, variant: "quote", content: "x" }] }] });
    expect(isTypographyStyleUsed(used, "quote")).toBe(true);
    expect(removeUnusedCustomTypographyStyle(used, "quote")).toBeNull();
    expect(removeUnusedCustomTypographyStyle(created, "quote")).not.toBeNull();
  });
});
