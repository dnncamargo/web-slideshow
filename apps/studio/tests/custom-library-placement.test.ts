import { describe, expect, it } from "vitest";
import type { ContentSlot, PowerShowElement, Slide, StructuredTableElement, TopicItem, TopicsElement } from "@powershow/document-schema";
import { collectAuthoringIds, findElementById } from "../src/features/editor/element-hierarchy";
import { placeCustomLibraryElementRecipe, type CustomLibraryPlacementResult } from "../src/features/custom-library/custom-library-placement";
import type { CustomLibraryElementRecipe } from "../src/features/custom-library/custom-library-recipe";

const slide = (elements: PowerShowElement[] = []): Slide => ({ id: "slide-1", title: "", summary: "", speakerNotes: "", elements });
const text = (id: string, content = id): PowerShowElement => ({ id, type: "text", hidden: false, variant: "body", content });
const image = (id: string): PowerShowElement => ({ id, type: "image", hidden: false, src: "/" + id + ".png", alt: id, fit: "contain" });
const container = (id: string, children: PowerShowElement[] = []): PowerShowElement => ({ id, type: "container", hidden: false, children });
const slot = (id: string, children: PowerShowElement[] = []): ContentSlot => ({ id, children });
const topics = (id: string, items: TopicItem[]): TopicsElement => ({ id, type: "topics", hidden: false, kind: "unordered", items });
function recipe(type: CustomLibraryElementRecipe["type"], properties: CustomLibraryElementRecipe["properties"] = [], children?: CustomLibraryElementRecipe[]): CustomLibraryElementRecipe {
  return children === undefined ? { type, properties } : { type, properties, children };
}
function success(result: CustomLibraryPlacementResult): Extract<CustomLibraryPlacementResult, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected success: " + result.reason);
  return result;
}
function allIds(slides: readonly Slide[]): Set<string> {
  const result = new Set<string>();
  for (const current of slides) for (const element of current.elements) collectAuthoringIds(element, result);
  return result;
}

describe("Custom Library placement core", () => {
  it("creates at root/end, handles stale selection, returns id, and avoids collisions", () => {
    const current = slide([text("first"), text("last")]);
    const allSlides = [current, slide([text("text-element-1")])];
    for (const selectedId of [null, "stale"]) {
      const result = success(placeCustomLibraryElementRecipe(recipe("text", [{ path: "content", value: "Created" }]), current, allSlides, selectedId));
      expect(result.mode).toBe("create-root");
      expect(result.slide.elements.map((element) => element.id)).toEqual(["first", "last", result.appliedElementId]);
      expect(allIds(allSlides)).not.toContain(result.appliedElementId);
    }
  });

  it("merges same-type roots in place and preserves id/order", () => {
    const current = slide([text("before"), text("selected", "Old"), text("after")]);
    const before = structuredClone(current);
    const result = success(placeCustomLibraryElementRecipe(recipe("text", [{ path: "content", value: "New" }]), current, [current], "selected"));
    expect(result.mode).toBe("merge-selected");
    expect(result.appliedElementId).toBe("selected");
    expect(result.slide.elements.map((element) => element.id)).toEqual(["before", "selected", "after"]);
    expect(findElementById(result.slide.elements, "selected")).toMatchObject({ content: "New" });
    expect(current).toEqual(before);
  });

  it("creates different types after a selected container, not inside it", () => {
    const current = slide([container("selected", [text("inside")]), text("after")]);
    const result = success(placeCustomLibraryElementRecipe(recipe("text"), current, [current], "selected"));
    expect(result.mode).toBe("create-sibling");
    expect(result.slide.elements.map((element) => element.id)).toEqual(["selected", result.appliedElementId, "after"]);
    const selected = result.slide.elements[0];
    if (selected?.type === "container") expect(selected.children.map((element) => element.id)).toEqual(["inside"]);
  });

  it("merges a container recipe into a selected container and inserts a complete tree", () => {
    const current = slide([container("selected", [text("existing")]), text("after")]);
    const merged = success(placeCustomLibraryElementRecipe(recipe("container", [], [recipe("text", [{ path: "content", value: "child" }])]), current, [current], "selected"));
    expect(merged.mode).toBe("merge-selected");
    expect(merged.appliedElementId).toBe("selected");
    const selected = merged.slide.elements[0];
    if (selected?.type === "container") expect(selected.children.map((element) => element.type)).toEqual(["text", "text"]);

    const created = success(placeCustomLibraryElementRecipe(recipe("container", [], [recipe("text"), recipe("image")]), current, [current], "after"));
    expect(created.mode).toBe("create-sibling");
    expect(created.slide.elements.map((element) => element.id)).toEqual(["selected", "after", created.appliedElementId]);
    const inserted = created.slide.elements[2];
    if (inserted?.type === "container") expect(inserted.children.map((element) => element.type)).toEqual(["text", "image"]);
  });

  it("keeps nested Container, table, and Topics siblings in the exact parent collection", () => {
    const table: StructuredTableElement = {
      id: "table", type: "table", mode: "structured", hidden: false, showHeader: true,
      columns: [{ id: "column", header: slot("header", [text("header-selected")]) }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [text("cell-selected")] }] }],
    };
    const current = slide([
      container("outer", [text("container-selected"), text("container-after")]), table,
      topics("topics", [{ id: "topic", content: slot("topic-slot", [text("topic-selected")]), children: [] }]),
    ]);
    const cases = ["container-selected", "header-selected", "cell-selected", "topic-selected"];
    for (const selectedId of cases) {
      const result = success(placeCustomLibraryElementRecipe(recipe("image"), current, [current], selectedId));
      expect(result.mode).toBe("create-sibling");
      const found = findElementById(result.slide.elements, selectedId);
      expect(found).toBeTruthy();
      if (selectedId === "container-selected") {
        const outer = result.slide.elements[0];
        if (outer?.type === "container") expect(outer.children.map((element) => element.id)).toEqual([selectedId, result.appliedElementId, "container-after"]);
      } else if (selectedId === "header-selected") {
        const resultTable = result.slide.elements[1];
        if (resultTable?.type === "table" && resultTable.mode === "structured") expect(resultTable.columns[0]?.header.children.map((element) => element.id)).toEqual([selectedId, result.appliedElementId]);
      } else if (selectedId === "cell-selected") {
        const resultTable = result.slide.elements[1];
        if (resultTable?.type === "table" && resultTable.mode === "structured") expect(resultTable.rows[0]?.cells[0]?.children.map((element) => element.id)).toEqual([selectedId, result.appliedElementId]);
      } else {
        const resultTopics = result.slide.elements[2];
        if (resultTopics?.type === "topics") expect(resultTopics.items[0]?.content.children.map((element) => element.id)).toEqual([selectedId, result.appliedElementId]);
      }
    }
  });

  it("merges same-type nested elements in Container and ContentSlot in place", () => {
    const current = slide([container("outer", [text("container-selected", "Old")]), topics("topics", [{ id: "topic", content: slot("slot", [text("slot-selected", "Old")]), children: [] }])]);
    for (const selectedId of ["container-selected", "slot-selected"]) {
      const result = success(placeCustomLibraryElementRecipe(recipe("text", [{ path: "content", value: "New" }]), current, [current], selectedId));
      expect(result.mode).toBe("merge-selected");
      expect(result.appliedElementId).toBe(selectedId);
      expect(findElementById(result.slide.elements, selectedId)).toMatchObject({ content: "New" });
    }
  });

  it("propagates unsupported create failures without modifying the slide", () => {
    const current = slide([text("selected")]);
    const before = structuredClone(current);
    expect(placeCustomLibraryElementRecipe(recipe("chart"), current, [current], null)).toEqual({ ok: false, reason: "unsupported-create-type" });
    expect(placeCustomLibraryElementRecipe(recipe("chart"), current, [current], "selected")).toEqual({ ok: false, reason: "unsupported-create-type" });
    expect(current).toEqual(before);
  });

  it("supports same-type Chart merge", () => {
    const chart: PowerShowElement = { id: "chart", type: "chart", hidden: false, source: "" };
    const current = slide([text("before"), chart, text("after")]);
    const result = success(placeCustomLibraryElementRecipe(recipe("chart", [{ path: "source", value: "y = x^2" }]), current, [current], "chart"));
    expect(result.mode).toBe("merge-selected");
    expect(result.appliedElementId).toBe("chart");
    expect(result.slide.elements.map((element) => element.id)).toEqual(["before", "chart", "after"]);
  });

  it("leaves slide, slides, and recipe unchanged on invalid application", () => {
    const current = slide([text("selected")]);
    const allSlides = [current, slide([image("other")])];
    const input = recipe("text", [{ path: "content", value: 42 }]);
    const before = { current: structuredClone(current), allSlides: structuredClone(allSlides), input: structuredClone(input) };
    expect(placeCustomLibraryElementRecipe(input, current, allSlides, null)).toEqual({ ok: false, reason: "invalid-recipe-application" });
    expect(current).toEqual(before.current);
    expect(allSlides).toEqual(before.allSlides);
    expect(input).toEqual(before.input);
  });
});
