import { describe, expect, it } from "vitest";
import {
  PowerShowElementSchema,
  type PowerShowElement,
  type Slide,
} from "@powershow/document-schema";

import { collectAuthoringIds } from "../src/features/editor/element-hierarchy";
import {
  materializeCustomLibraryElementRecipe,
  mergeCustomLibraryElementRecipe,
} from "../src/features/custom-library/custom-library-apply";
import type { CustomLibraryElementRecipe } from "../src/features/custom-library/custom-library-recipe";

const slide = (elements: PowerShowElement[] = []): Slide => ({
  id: "slide-1",
  title: "",
  summary: "",
  speakerNotes: "",
  elements,
});
const slides: Slide[] = [slide()];

function text(id: string, content: string): PowerShowElement {
  return { id, type: "text", hidden: false, content, variant: "body" };
}

function authoringIds(element: PowerShowElement): Set<string> {
  const result = new Set<string>();
  collectAuthoringIds(element, result);
  return result;
}

function recipe(
  type: CustomLibraryElementRecipe["type"],
  properties: CustomLibraryElementRecipe["properties"] = [],
  children?: CustomLibraryElementRecipe[],
): CustomLibraryElementRecipe {
  return children === undefined ? { type, properties } : { type, properties, children };
}

function ids(element: PowerShowElement): Set<string> {
  return authoringIds(element);
}

describe("Custom Library apply core", () => {
  it("materializes with create defaults and selected properties", () => {
    const result = materializeCustomLibraryElementRecipe(
      recipe("text", [{ path: "typography.fontFamily", value: "Roboto" }]),
      slides,
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "text") return;
    expect(result.element.content).toBe("New text");
    expect(result.element.typography?.fontFamily).toBe("Roboto");
    expect(result.element.id).not.toBe("text-element-1");
    expect(PowerShowElementSchema.safeParse(result.element).success).toBe(true);
  });

  it("materializes an empty recipe with ordinary create defaults", () => {
    const result = materializeCustomLibraryElementRecipe(recipe("text"), slides);

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "text") return;
    expect(result.element.content).toBe("New text");
    expect(result.element.variant).toBe("body");
  });

  it("replaces explicitly selected content and does not mutate inputs", () => {
    const source = recipe("text", [{ path: "content", value: "Saved" }]);
    const sourceBefore = structuredClone(source);
    const slidesBefore = structuredClone(slides);
    const result = materializeCustomLibraryElementRecipe(source, slides);

    expect(result.ok && result.element.type === "text" && result.element.content).toBe("Saved");
    expect(source).toEqual(sourceBefore);
    expect(slides).toEqual(slidesBefore);
  });

  it("materializes nested container children in order with fresh ids", () => {
    const result = materializeCustomLibraryElementRecipe(
      recipe("container", [], [
        recipe("text", [{ path: "content", value: "A" }]),
        recipe("container", [], [recipe("text", [{ path: "content", value: "B" }])]),
      ]),
      [slide([text("text-element-1", "Existing")])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "container") return;
    expect(result.element.children.map((child) => child.type)).toEqual(["text", "container"]);
    expect(result.element.children[0]?.type === "text" && result.element.children[0].content).toBe("A");
    expect(result.element.children[1]?.type === "container").toBe(true);
    expect(new Set([...ids(result.element)]).size).toBe(4);
    expect([...ids(result.element)].some((id) => id === "text-element-1")).toBe(false);
  });

  it("remaps intrinsic table authoring ids", () => {
    const sourceTable: PowerShowElement = {
      id: "source-table",
      type: "table",
      mode: "structured",
      hidden: false,
      showHeader: true,
      columns: [{ id: "source-column", header: { id: "source-header", children: [text("source-header-text", "H")] } }],
      rows: [{ id: "source-row", cells: [{ id: "source-cell", children: [text("source-cell-text", "V")] }] }],
    };
    const result = materializeCustomLibraryElementRecipe(
      recipe("table", [{ path: "rows", value: sourceTable.type === "table" ? sourceTable.rows : [] }]),
      [slide([text("source-row", "collision")])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "table" || result.element.mode !== "structured") return;
    expect(result.element.rows[0]?.id).not.toBe("source-row");
    expect(result.element.rows[0]?.cells[0]?.id).not.toBe("source-cell");
    expect(result.element.rows[0]?.cells[0]?.children[0]?.id).not.toBe("source-cell-text");
  });

  it("remaps Topics intrinsic ids and leaves the recipe payload unchanged", () => {
    const items = [{
      id: "topic-item-source",
      content: { id: "topic-slot-source", children: [text("topic-text-source", "Topic")] },
      children: [],
    }];
    const source = recipe("topics", [
      { path: "items", value: items },
    ]);
    const before = structuredClone(source);
    const result = materializeCustomLibraryElementRecipe(source, [slide([text("topic-item-source", "collision")])]);

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "topics") return;
    expect(result.element.items[0]?.id).not.toBe("topic-item-source");
    expect(result.element.items[0]?.content.id).not.toBe("topic-slot-source");
    expect(result.element.items[0]?.content.children[0]?.id).not.toBe("topic-text-source");
    expect(source).toEqual(before);
    expect(PowerShowElementSchema.safeParse(result.element).success).toBe(true);
  });

  it("remaps coherent Blocks intrinsic ids", () => {
    const items = [{
      id: "block-item-source",
      categoryId: "category-source",
      shape: "statement" as const,
      parts: [
        { id: "block-text-part-source", type: "text" as const, text: "when" },
        {
          id: "block-socket-part-source",
          type: "socket" as const,
          content: {
            type: "block" as const,
            block: {
              id: "nested-block-source",
              categoryId: "category-source",
              shape: "value" as const,
              parts: [{ id: "nested-part-source", type: "text" as const, text: "true" }],
              children: [],
            },
          },
        },
      ],
      children: [],
    }];
    const result = materializeCustomLibraryElementRecipe(recipe("blocks", [
      { path: "categories", value: [{ id: "category-source", name: "Logic", color: "#6366f1" }] },
      { path: "items", value: items },
    ]), slides);

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "blocks") return;
    const created = result.element.items[0];
    expect(created?.id).not.toBe("block-item-source");
    expect(created?.parts[0]?.id).not.toBe("block-text-part-source");
    expect(created?.parts[1]?.id).not.toBe("block-socket-part-source");
    if (created?.parts[1]?.type === "socket" && created.parts[1].content.type === "block") {
      expect(created.parts[1].content.block.id).not.toBe("nested-block-source");
      expect(created.parts[1].content.block.parts[0]?.id).not.toBe("nested-part-source");
    }
    expect(PowerShowElementSchema.safeParse(result.element).success).toBe(true);
  });

  it("merges same-type properties while preserving identity and omitted values", () => {
    const target: PowerShowElement = {
      id: "title-1",
      type: "text",
      hidden: false,
      content: "Existing",
      variant: "body",
      typography: { fontFamily: "Inter", fontSize: "40px" },
    };
    const result = mergeCustomLibraryElementRecipe(
      recipe("text", [{ path: "typography.fontFamily", value: "Roboto" }]),
      target,
      [slide([target])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "text") return;
    expect(result.element.id).toBe("title-1");
    expect(result.element.content).toBe("Existing");
    expect(result.element.typography).toEqual({ fontFamily: "Roboto", fontSize: "40px" });
  });

  it("appends recipe children without changing existing child ids", () => {
    const target: PowerShowElement = {
      id: "container-1",
      type: "container",
      hidden: false,
      children: [text("existing-child", "Existing")],
    };
    const result = mergeCustomLibraryElementRecipe(
      recipe("container", [], [recipe("text", [{ path: "content", value: "New" }])]),
      target,
      [slide([target])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "container") return;
    expect(result.element.children.map((child) => child.id)).toHaveLength(2);
    expect(result.element.children[0]?.id).toBe("existing-child");
    expect(result.element.children[1]?.id).not.toBe("existing-child");
    expect(result.element.children[1]?.type === "text" && result.element.children[1].content).toBe("New");
  });

  it("merges table rows with fresh ids while preserving unselected columns", () => {
    const target: PowerShowElement = {
      id: "table-target",
      type: "table",
      mode: "structured",
      hidden: false,
      showHeader: true,
      columns: [{ id: "existing-column", header: { id: "existing-header", children: [text("existing-header-text", "H")] } }],
      rows: [{ id: "existing-row", cells: [{ id: "existing-cell", children: [text("existing-cell-text", "Old")] }] }],
    };
    const recipeRows = [{ id: "recipe-row", cells: [{ id: "recipe-cell", children: [text("recipe-cell-text", "New")] }] }];
    const result = mergeCustomLibraryElementRecipe(recipe("table", [{ path: "rows", value: recipeRows }]), target, [slide([target])]);

    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "table" || result.element.mode !== "structured") return;
    expect(result.element.id).toBe("table-target");
    expect(result.element.columns[0]?.id).toBe("existing-column");
    expect(result.element.columns[0]?.header.id).toBe("existing-header");
    expect(result.element.rows[0]?.id).not.toBe("recipe-row");
    expect(result.element.rows[0]?.cells[0]?.id).not.toBe("recipe-cell");
    expect(result.element.rows[0]?.cells[0]?.children[0]?.id).not.toBe("recipe-cell-text");
    expect(result.element.rows[0]?.cells[0]?.children[0]?.id).not.toBe("existing-cell-text");
  });

  it("replaces atomic link values, preserves empty merges, and applies hidden", () => {
    const target: PowerShowElement = {
      id: "linked-image",
      type: "image",
      hidden: false,
      src: "/image.png",
      alt: "Keep",
      fit: "contain",
      link: { kind: "url", href: "https://old.example", target: "_blank" },
    };
    const atomic = mergeCustomLibraryElementRecipe(recipe("image", [
      { path: "link", value: { kind: "url", href: "https://new.example" } },
    ]), target, [slide([target])]);
    expect(atomic.ok && atomic.element.type === "image" && atomic.element.link).toEqual({ kind: "url", href: "https://new.example" });

    const empty = mergeCustomLibraryElementRecipe(recipe("image"), target, [slide([target])]);
    expect(empty.ok && empty.element).toEqual(target);
    const hidden = mergeCustomLibraryElementRecipe(recipe("image", [{ path: "hidden", value: true }]), target, [slide([target])]);
    expect(hidden.ok && hidden.element.type === "image" && hidden.element.hidden).toBe(true);
  });

  it("rejects mismatches, unsupported creates, invalid values, and unsafe paths", () => {
    const target = text("target", "Target");
    expect(mergeCustomLibraryElementRecipe(recipe("image"), target, slides)).toEqual({ ok: false, reason: "type-mismatch" });
    expect(materializeCustomLibraryElementRecipe(recipe("chart"), slides)).toEqual({ ok: false, reason: "unsupported-create-type" });
    expect(materializeCustomLibraryElementRecipe(recipe("text", [{ path: "content", value: 42 }]), slides)).toEqual({ ok: false, reason: "invalid-recipe-application" });
    for (const path of ["__proto__.polluted", "constructor.x", "prototype.x", "typography..fontSize", "content.0"]) {
      expect(materializeCustomLibraryElementRecipe(recipe("text", [{ path, value: "x" }]), slides)).toEqual({ ok: false, reason: "invalid-recipe-application" });
    }
  });

  it("rejects stale paths and non-clonable values without throwing or mutating inputs", () => {
    const target = text("target", "Target");
    const stale = recipe("text", [{ path: "invented.field", value: "x" }]);
    const staleBefore = structuredClone(stale);
    expect(materializeCustomLibraryElementRecipe(stale, slides)).toEqual({ ok: false, reason: "invalid-recipe-application" });
    expect(stale).toEqual(staleBefore);

    const nonClonable = recipe("text", [{ path: "content", value: () => "nope" }]);
    expect(() => materializeCustomLibraryElementRecipe(nonClonable, slides)).not.toThrow();
    expect(materializeCustomLibraryElementRecipe(nonClonable, slides)).toEqual({ ok: false, reason: "invalid-recipe-application" });
    expect(target).toEqual(text("target", "Target"));
    expect(slides).toEqual([slide()]);
  });

  it("rejects unsupported descendants without returning a partial root", () => {
    const result = materializeCustomLibraryElementRecipe(recipe("container", [], [
      recipe("text", [{ path: "content", value: "Supported" }]),
      recipe("chart", []),
    ]), slides);
    expect(result).toEqual({ ok: false, reason: "unsupported-create-type" });
  });

  it("merges unsupported-create Chart elements when their type matches", () => {
    const target: PowerShowElement = {
      id: "chart-target",
      type: "chart",
      hidden: false,
      chartType: "line",
      series: [{ name: "Old", values: [{ x: 0, y: 1 }] }],
    };
    const result = mergeCustomLibraryElementRecipe(recipe("chart", [
      { path: "series", value: [{ name: "New", values: [{ x: 1, y: 2 }] }] },
    ]), target, [slide([target])]);
    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "chart") return;
    expect(result.element.id).toBe("chart-target");
    expect(result.element.series[0]?.name).toBe("New");
    expect(PowerShowElementSchema.safeParse(result.element).success).toBe(true);
  });

  it("does not recursively match same-type container children", () => {
    const target: PowerShowElement = {
      id: "parent",
      type: "container",
      hidden: false,
      children: [text("existing-child", "Existing")],
    };
    const result = mergeCustomLibraryElementRecipe(recipe("container", [], [recipe("text", [{ path: "content", value: "New" }])]), target, [slide([target])]);
    expect(result.ok).toBe(true);
    if (!result.ok || result.element.type !== "container") return;
    expect(result.element.children).toHaveLength(2);
    expect(result.element.children[0]?.id).toBe("existing-child");
    expect(result.element.children[1]?.id).not.toBe("existing-child");
    expect(result.element.children[0]?.type === "text" && result.element.children[0].content).toBe("Existing");
  });
});
