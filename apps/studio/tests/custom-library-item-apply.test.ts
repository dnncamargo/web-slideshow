import { describe, expect, it } from "vitest";
import { PresentationSchema, resolveTextStyle, type FontFaceResource, type LinkedStyle, type Presentation, type TextStyle } from "@web-slideshow/document-schema";

import { applyCustomLibraryItemToPresentation } from "../src/features/custom-library/custom-library-item-apply";
import type { CustomLibraryItemDraft } from "../src/features/custom-library/custom-library-item";

const face = (url: string, extra: Partial<FontFaceResource> = {}): FontFaceResource => ({
  weight: 400,
  style: "normal",
  subset: "latin",
  source: { type: "url", url, format: "woff2" },
  ...extra,
});

function presentation(
  elements = [],
  fonts?: NonNullable<Presentation["resources"]>["fonts"],
  textStyles?: TextStyle[],
  linkedStyles?: LinkedStyle[],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "item-apply",
    title: "Item apply",
    slides: [{ id: "slide", title: "Slide", elements }],
    ...(fonts ? { resources: { fonts } } : {}),
    ...(textStyles ? { textStyles } : {}),
    ...(linkedStyles ? { linkedStyles } : {}),
  });
}

const textRecipe = (fontFamily?: string) => ({
  type: "text" as const,
  properties: [
    { path: "content", value: "Applied" },
    ...(fontFamily ? [{ path: "typography.fontFamily", value: fontFamily }] : []),
  ],
});

function item(root: CustomLibraryItemDraft["root"], fonts?: CustomLibraryItemDraft["dependencies"]): CustomLibraryItemDraft {
  return { name: "Style", root, ...(fonts ? { dependencies: fonts } : {}) };
}

describe("applyCustomLibraryItemToPresentation", () => {
  it("applies legacy items without inventing resources", () => {
    const original = presentation();
    const style = item(textRecipe());
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toMatchObject({ ok: true, mode: "create-root" });
    if (!result.ok) return;
    expect(result.presentation.resources).toBeUndefined();
    expect(original).toEqual(presentation());
    expect(style).toEqual(item(textRecipe()));
  });

  it("materializes a missing font and places the authored recipe", () => {
    const original = presentation();
    const style = item(textRecipe("Fira Code"), { fonts: [{ family: "Fira Code", faces: [face("https://example.com/fira.woff2")] }] });
    const presentationBefore = structuredClone(original);
    const itemBefore = structuredClone(style);
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("create-root");
    const appliedElement = result.presentation.slides[0]?.elements[0];
    expect(appliedElement).toMatchObject({ type: "text", typography: { fontFamily: "Fira Code" } });
    expect(result.appliedElementId).toBe(appliedElement?.id);
    expect(result.presentation.resources?.fonts).toHaveLength(1);
    const resultFace = result.presentation.resources?.fonts?.[0]?.faces?.[0];
    const dependencyFace = style.dependencies?.fonts?.[0]?.faces[0];
    expect(resultFace).toBeDefined();
    expect(dependencyFace).toBeDefined();
    expect(resultFace).not.toBe(dependencyFace);
    expect(resultFace?.source).not.toBe(dependencyFace?.source);
    expect(original).toEqual(presentationBefore);
    expect(style).toEqual(itemBefore);
  });

  it("allocates applied recipe trees outside Root/local reservations", () => {
    const original = PresentationSchema.parse({
      schemaVersion: 1,
      id: "root-library-apply",
      title: "Item apply",
      rootDefinitions: [{
        id: "root-definition",
        name: "Root Definition",
        localChildTargetIds: ["root-container"],
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: [
            { id: "container-element", type: "text", hidden: false, variant: "body", content: "container" },
            { id: "text-element", type: "text", hidden: false, variant: "body", content: "text" },
            { id: "image-element", type: "text", hidden: false, variant: "body", content: "image" },
          ],
        },
      }],
      slides: [{ id: "slide", title: "Slide", summary: "", speakerNotes: "", elements: [] }],
    });
    const style = item({
      type: "container",
      properties: [],
      children: [
        { type: "text", properties: [{ path: "content", value: "Applied text" }] },
        { type: "image", properties: [] },
      ],
    });
    const before = structuredClone(original);
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const applied = result.presentation.slides[0]?.elements[0];
    expect(applied?.id).not.toBe("container-element");
    if (applied?.type !== "container") return;
    expect(applied.children.map((child) => child.id)).not.toContain("text-element");
    expect(applied.children.map((child) => child.id)).not.toContain("image-element");
    expect(original).toEqual(before);
  });

  it("materializes a missing Text Style and keeps the applied variant resolvable", () => {
    const original = presentation();
    const style = item({ type: "text", properties: [
      { path: "content", value: "Applied" },
      { path: "variant", value: "example" },
    ] }, { textStyles: [{ id: "example", name: "Example", role: "body" }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.textStyles).toEqual([{ id: "example", name: "Example", role: "body" }]);
    const applied = result.presentation.slides[0]?.elements[0];
    expect(applied).toMatchObject({ variant: "example" });
    expect(applied?.type === "text" ? () => resolveTextStyle(result.presentation, applied) : undefined).not.toThrow();
  });

  it("reuses an equivalent Text Style with the same ID", () => {
    const existing = { id: "example", name: "Example", role: "body" as const };
    const original = presentation([], undefined, [existing]);
    const style = item({ type: "text", properties: [{ path: "variant", value: "example" }] }, { textStyles: [existing] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.textStyles).toEqual([existing]);
  });

  it("remaps a conflicting Text Style without overwriting the destination", () => {
    const existing = { id: "example", name: "Local", role: "title" as const };
    const imported = { id: "example", name: "Example", role: "body" as const };
    const original = presentation([], undefined, [existing]);
    const style = item({ type: "text", properties: [{ path: "variant", value: "example" }] }, { textStyles: [imported] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.textStyles).toEqual([existing, { ...imported, id: "example-2" }]);
    expect(result.presentation.slides[0]?.elements[0]).toMatchObject({ variant: "example-2" });
    expect(original.textStyles).toEqual([existing]);
  });

  it("reserves incoming Text Style source IDs during collision generation", () => {
    const existing = { id: "example", name: "Local", role: "title" as const };
    const first = { id: "example", name: "Imported", role: "body" as const };
    const second = { id: "imported", name: "Second", role: "caption" as const };
    const original = presentation([], undefined, [existing]);
    const style = item({ type: "container", properties: [], children: [
      { type: "text", properties: [{ path: "variant", value: "example" }] },
      { type: "text", properties: [{ path: "variant", value: "imported" }] },
    ] }, { textStyles: [first, second] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const importedStyles = result.presentation.textStyles ?? [];
    expect(importedStyles.find((candidate) => candidate.id === "example")).toEqual(existing);
    expect(importedStyles.find((candidate) => candidate.id === "imported")).toEqual(second);
    expect(new Set(importedStyles.map((candidate) => candidate.id)).size).toBe(importedStyles.length);
    const container = result.presentation.slides[0]?.elements[0];
    const variants = container?.type === "container"
      ? container.children.filter((child): child is Extract<typeof child, { type: "text" }> => child.type === "text").map((child) => child.variant)
      : [];
    expect(variants).toContain("imported");
    expect(variants.find((variant) => variant !== "imported")).not.toBe("example");
  });

  it("materializes and remaps a conflicting Linked Style", () => {
    const existing = { id: "card", name: "Local", layout: { padding: 2 } };
    const imported = { id: "card", name: "Card", layout: { padding: 8 } };
    const original = presentation([], undefined, undefined, [existing]);
    const style = item({ type: "container", properties: [{ path: "linkedStyleId", value: "card" }] }, { linkedStyles: [imported] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.linkedStyles).toEqual([existing, { ...imported, id: "card-2" }]);
    expect(result.presentation.slides[0]?.elements[0]).toMatchObject({ linkedStyleId: "card-2" });
  });

  it("reserves incoming Linked Style source IDs during collision generation", () => {
    const existing = { id: "card", name: "Local", layout: { padding: 2 } };
    const first = { id: "card", name: "Imported", layout: { padding: 8 } };
    const second = { id: "imported", name: "Second", layout: { padding: 16 } };
    const original = presentation([], undefined, undefined, [existing]);
    const style = item({ type: "container", properties: [{ path: "linkedStyleId", value: "card" }] }, { linkedStyles: [first, second] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const linkedStyles = result.presentation.linkedStyles ?? [];
    expect(linkedStyles.find((candidate) => candidate.id === "card")).toEqual(existing);
    expect(linkedStyles.find((candidate) => candidate.id === "imported")).toEqual(second);
    expect(new Set(linkedStyles.map((candidate) => candidate.id)).size).toBe(linkedStyles.length);
  });

  it("materializes a missing Linked Style and reuses an equivalent one", () => {
    const imported = { id: "card", name: "Card", layout: { padding: 8 } };
    const style = item({ type: "container", properties: [{ path: "linkedStyleId", value: "card" }] }, { linkedStyles: [imported] });
    const added = applyCustomLibraryItemToPresentation(style, presentation(), 0, null);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.presentation.linkedStyles).toEqual([imported]);
    expect(added.presentation.slides[0]?.elements[0]).toMatchObject({ linkedStyleId: "card" });

    const reused = applyCustomLibraryItemToPresentation(style, presentation([], undefined, undefined, [imported]), 0, null);
    expect(reused.ok).toBe(true);
    if (!reused.ok) return;
    expect(reused.presentation.linkedStyles).toEqual([imported]);
  });

  it("remaps custom variants in nested recipe children", () => {
    const existing = { id: "example", name: "Local", role: "title" as const };
    const style = item({ type: "container", properties: [], children: [{
      type: "text", properties: [{ path: "variant", value: "example" }],
    }] }, { textStyles: [{ id: "example", name: "Imported", role: "body" }] });
    const result = applyCustomLibraryItemToPresentation(style, presentation([], undefined, [existing]), 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const container = result.presentation.slides[0]?.elements[0];
    expect(container?.type === "container" ? container.children[0] : undefined).toMatchObject({ variant: "imported" });
  });

  it("remaps dependencies in Topics and Structured Table bounded payloads", () => {
    const topicsText = { type: "text" as const, id: "topic-text", hidden: false, content: "Topic", variant: "example" };
    const tableText = { type: "text" as const, id: "table-text", hidden: false, content: "Header", variant: "example" };
    const topics: CustomLibraryItemDraft["root"] = {
      type: "topics", properties: [{ path: "items", value: [{ id: "topic", content: { id: "slot", children: [topicsText] }, children: [] }] }],
    };
    const table: CustomLibraryItemDraft["root"] = {
      type: "table", properties: [{ path: "columns", value: [{ id: "column", header: { id: "header", children: [tableText] } }] }],
    };
    const dependencies = { textStyles: [{ id: "example", name: "Imported", role: "body" as const }] };
    const destination = presentation([], undefined, [{ id: "example", name: "Local", role: "title" }]);

    const topicResult = applyCustomLibraryItemToPresentation(item(topics, dependencies), destination, 0, null);
    const tableResult = applyCustomLibraryItemToPresentation(item(table, dependencies), destination, 0, null);

    expect(topicResult.ok).toBe(true);
    expect(tableResult.ok).toBe(true);
    if (!topicResult.ok || !tableResult.ok) return;
    expect(topicResult.presentation.textStyles).toHaveLength(2);
    expect(tableResult.presentation.textStyles).toHaveLength(2);
    expect(JSON.stringify(topicResult.presentation.slides[0]?.elements[0])).toContain('"variant":"imported"');
    expect(JSON.stringify(tableResult.presentation.slides[0]?.elements[0])).toContain('"variant":"imported"');
  });

  it("allows a legacy custom variant only when it resolves in the destination", () => {
    const original = presentation([], undefined, [{ id: "example", name: "Example", role: "body" }]);
    const style = item({ type: "text", properties: [{ path: "variant", value: "example" }] });
    expect(applyCustomLibraryItemToPresentation(style, original, 0, null).ok).toBe(true);
  });

  it("rejects a legacy Linked Style that is absent from the destination", () => {
    const original = presentation();
    const style = item({ type: "container", properties: [{ path: "linkedStyleId", value: "missing" }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toEqual({ ok: false, reason: "invalid-recipe-application" });
    expect(original.slides[0]?.elements).toHaveLength(0);
  });

  it("rejects a Linked Style with an incompatible target", () => {
    const original = presentation();
    const style = item({ type: "container", properties: [{ path: "linkedStyleId", value: "shared" }] }, {
      linkedStyles: [{ target: "topics", id: "shared", name: "Topics", kind: "ordered" }],
    });

    expect(applyCustomLibraryItemToPresentation(style, original, 0, null)).toEqual({
      ok: false,
      reason: "invalid-recipe-application",
    });
    expect(original.slides[0]?.elements).toHaveLength(0);
  });

  it("does not let a generated collision ID validate a legacy reference", () => {
    const original = presentation([], undefined, [{ id: "example", name: "Local", role: "title" }]);
    const style = item({ type: "container", properties: [], children: [
      { type: "text", properties: [
        { path: "variant", value: "example" },
      ] },
      { type: "text", properties: [
        { path: "variant", value: "missing" },
      ] },
    ] }, { textStyles: [{ id: "example", name: "Missing", role: "body" }] });
    const before = structuredClone(original);

    expect(applyCustomLibraryItemToPresentation(style, original, 0, null)).toEqual({
      ok: false,
      reason: "invalid-recipe-application",
    });
    expect(original).toEqual(before);
  });

  it("blocks unresolved legacy references before placement", () => {
    const original = presentation();
    const before = structuredClone(original);
    const style = item({ type: "text", properties: [{ path: "variant", value: "missing" }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toEqual({ ok: false, reason: "invalid-recipe-application" });
    expect(original).toEqual(before);
  });

  it("preserves the persisted item during dependency materialization and remapping", () => {
    const original = presentation([], undefined, [{ id: "example", name: "Local", role: "title" }]);
    const style = item({ type: "text", properties: [{ path: "variant", value: "example" }] }, { textStyles: [{ id: "example", name: "Example", role: "body" }] });
    const before = structuredClone(style);
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.presentation.slides[0]?.elements[0]).toMatchObject({ variant: "example-2" });
    }
    expect(style).toEqual(before);
  });

  it("reuses an equivalent resource and merges missing faces", () => {
    const original = presentation([], [{ id: "fira-local", family: "Fira Code", faces: [face("https://example.com/regular.woff2")] }]);
    const style = item(textRecipe("Fira Code"), { fonts: [{ family: "fira code", faces: [face("https://example.com/regular.woff2"), face("https://example.com/bold.woff2", { weight: 700 })] }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.resources?.fonts).toHaveLength(1);
    expect(result.presentation.resources?.fonts?.[0]).toMatchObject({ id: "fira-local" });
    expect(result.presentation.resources?.fonts?.[0]?.faces).toHaveLength(2);
  });

  it("rejects a font conflict without changing the original", () => {
    const original = presentation([], [{ id: "fira-local", family: "Fira Code", faces: [face("https://example.com/local.woff2")] }]);
    const before = structuredClone(original);
    const style = item(textRecipe("Fira Code"), { fonts: [{ family: "fira code", faces: [face("https://example.com/other.woff2")] }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toEqual({ ok: false, reason: "font-dependency-conflict" });
    expect(original).toEqual(before);
    expect(original.slides[0]?.elements).toHaveLength(0);
  });

  it("rolls back earlier dependencies when a later dependency conflicts", () => {
    const original = presentation([], [{ id: "inter-local", family: "Inter", faces: [face("https://example.com/inter-local.woff2")] }]);
    const style = item(textRecipe("Fira Code"), { fonts: [
      { family: "Fira Code", faces: [face("https://example.com/fira.woff2")] },
      { family: "Inter", faces: [face("https://example.com/inter-other.woff2")] },
    ] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toEqual({ ok: false, reason: "font-dependency-conflict" });
    expect(original.resources?.fonts?.map((font) => font.family)).toEqual(["Inter"]);
  });

  it("rolls back materialized fonts when placement fails", () => {
    const original = presentation();
    const style = item({ type: "interactive", properties: [] }, { fonts: [{ family: "Fira Code", faces: [face("https://example.com/fira.woff2")] }] });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null);

    expect(result).toEqual({ ok: false, reason: "unsupported-create-type" });
    expect(original).toEqual(presentation());
  });

  it("rejects owner writes atomically after dependency materialization", () => {
    const original = presentation();
    const before = structuredClone(original);
    const style = item(textRecipe("Fira Code"), {
      fonts: [{ family: "Fira Code", faces: [face("https://example.com/fira.woff2")] }],
    });
    const result = applyCustomLibraryItemToPresentation(style, original, 0, null, {
      resolveElements: (current) => current.slides[0]?.elements ?? null,
      replaceElements: () => null,
    });

    expect(result).toEqual({ ok: false, reason: "invalid-recipe-application" });
    expect(original).toEqual(before);
    expect(original.resources).toBeUndefined();
    expect(original.slides[0]?.elements).toEqual([]);
  });
});
