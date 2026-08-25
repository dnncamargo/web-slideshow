import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import {
  composeCustomLibraryElementRecipe,
  type ElementPropertySelectionMap,
} from "../src/features/custom-library/custom-library-recipe";

const compose = (
  root: PowerShowElement,
  selections: ElementPropertySelectionMap = new Map(),
) => composeCustomLibraryElementRecipe(root, selections);

describe("composeCustomLibraryElementRecipe", () => {
  it("composes a leaf with explicit properties and omits children", () => {
    const text: PowerShowElement = {
      type: "text",
      id: "title-1",
      hidden: false,
      content: "Introduction",
      variant: "title",
      typography: { fontFamily: "Inter", fontSize: "46px" },
    };

    expect(compose(text, new Map([
      [text.id, new Set(["variant", "typography.fontFamily", "typography.fontSize"])],
    ]))).toEqual({
      type: "text",
      properties: [
        { path: "variant", value: "title" },
        { path: "typography.fontFamily", value: "Inter" },
        { path: "typography.fontSize", value: "46px" },
      ],
    });
  });

  it("uses defaults only when selection is absent and preserves explicit empty selections", () => {
    const text: PowerShowElement = {
      type: "text",
      id: "text-1",
      hidden: false,
      content: "Text",
      variant: "body",
    };

    expect(compose(text).properties).toEqual([
      { path: "variant", value: "body" },
    ]);
    expect(compose(text, new Map([[text.id, new Set()]])).properties).toEqual([]);
  });

  it("recursively composes container children without including canonical children as properties", () => {
    const text: PowerShowElement = {
      type: "text",
      id: "text-b",
      hidden: false,
      content: "Child",
      variant: "body",
    };
    const root: PowerShowElement = {
      type: "container",
      id: "container-a",
      hidden: false,
      layout: { children: { direction: "column", gap: "12px" } },
      children: [text],
    };

    const recipe = compose(root, new Map([
      [root.id, new Set(["layout.children.gap"])],
    ]));

    expect(recipe).toEqual({
      type: "container",
      properties: [{ path: "layout.children.gap", value: "12px" }],
      children: [{
        type: "text",
        properties: [{ path: "variant", value: "body" }],
      }],
    });
    expect(recipe.properties).not.toContainEqual(expect.objectContaining({ path: "children" }));
  });

  it("preserves nested authored order and retains children with empty properties", () => {
    const childB: PowerShowElement = {
      type: "container",
      id: "container-b",
      hidden: false,
      children: [{
        type: "text",
        id: "text-c",
        hidden: false,
        content: "C",
        variant: "body",
      }],
    };
    const childD: PowerShowElement = {
      type: "container",
      id: "container-d",
      hidden: false,
      children: [{
        type: "text",
        id: "text-e",
        hidden: false,
        content: "E",
        variant: "body",
      }],
    };
    const root: PowerShowElement = {
      type: "container",
      id: "container-a",
      hidden: false,
      children: [childB, {
        type: "image",
        id: "image-c",
        hidden: false,
        src: "image.png",
        alt: "Image",
        fit: "contain",
      }, childD],
    };

    const recipe = compose(root, new Map([
      [childB.id, new Set()],
      ["image-c", new Set()],
    ]));

    expect(recipe.children?.map((child) => child.type)).toEqual([
      "container", "image", "container",
    ]);
    expect(recipe.children?.[0]).toEqual({
      type: "container",
      properties: [],
      children: [{ type: "text", properties: [{ path: "variant", value: "body" }] }],
    });
    expect(recipe.children?.[1]).toEqual({ type: "image", properties: [] });
    expect(recipe.children?.[2]?.children?.[0]).toEqual({
      type: "text",
      properties: [{ path: "variant", value: "body" }],
    });
  });

  it("keeps each element selection independent and excludes source ids", () => {
    const root: PowerShowElement = {
      type: "container",
      id: "root-id",
      hidden: false,
      layout: { position: "absolute", right: "2%", bottom: "3%" },
      children: [{
        type: "scripted",
        id: "script-id",
        hidden: false,
        title: "Widget",
        html: "<div />",
        css: ".x {}",
        script: "alert(1)",
      }],
    };

    const recipe = compose(root, new Map([
      [root.id, new Set(["layout.position", "layout.right", "layout.bottom"])],
      ["script-id", new Set(["html"])],
    ]));

    expect(recipe).toEqual({
      type: "container",
      properties: [
        { path: "layout.position", value: "absolute" },
        { path: "layout.right", value: "2%" },
        { path: "layout.bottom", value: "3%" },
      ],
      children: [{
        type: "scripted",
        properties: [{ path: "html", value: "<div />" }],
      }],
    });
    expect(JSON.stringify(recipe)).not.toContain("root-id");
    expect(JSON.stringify(recipe)).not.toContain("script-id");
  });

  it("keeps intrinsic payload arrays as properties and isolates recipe values", () => {
    const table: PowerShowElement = {
      type: "table",
      id: "table-id",
      hidden: false,
      mode: "simple",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "PowerShow" }],
    };
    const selections = new Map([[table.id, new Set(["rows"])]]);
    const before = JSON.stringify(table);
    const recipe = compose(table, selections);
    const rows = recipe.properties[0]?.value as Array<Record<string, string>>;

    rows[0]!.name = "Recipe";
    expect(table.rows[0]).toEqual({ name: "PowerShow" });
    expect(JSON.stringify(table)).toBe(before);
    expect(recipe).not.toHaveProperty("children");
    expect([...selections.get(table.id)!]).toEqual(["rows"]);
  });
});
