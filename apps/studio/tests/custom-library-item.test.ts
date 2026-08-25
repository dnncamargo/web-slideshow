import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import {
  createCustomLibraryItemDraft,
  type CreateCustomLibraryItemDraftInput,
} from "../src/features/custom-library/custom-library-item";

const text = (id = "text-1"): PowerShowElement => ({
  type: "text",
  id,
  hidden: false,
  content: "Presentation title",
  variant: "title",
  typography: { fontFamily: "Inter", fontSize: "46px" },
});

const inputFor = (
  root: PowerShowElement = text(),
  overrides: Partial<CreateCustomLibraryItemDraftInput> = {},
): CreateCustomLibraryItemDraftInput => ({
  name: "Widget",
  root,
  selections: new Map(),
  ...overrides,
});

describe("createCustomLibraryItemDraft", () => {
  it("creates a text item draft with normalized metadata", () => {
    expect(createCustomLibraryItemDraft(inputFor(text(), {
      name: "  Presentation Title  ",
      description: "  Main title typography  ",
      selections: new Map([["text-1", new Set(["variant", "typography.fontFamily"])]]) ,
    }))).toEqual({
      name: "Presentation Title",
      description: "Main title typography",
      root: {
        type: "text",
        properties: [
          { path: "variant", value: "title" },
          { path: "typography.fontFamily", value: "Inter" },
        ],
      },
    });
  });

  it.each(["", "   ", "\n\t"]) ("rejects an empty normalized name: %j", (name) => {
    expect(() => createCustomLibraryItemDraft(inputFor(text(), { name })))
      .toThrow("Custom Library item name must not be empty");
  });

  it("omits absent and whitespace-only descriptions", () => {
    expect(createCustomLibraryItemDraft(inputFor())).not.toHaveProperty("description");
    expect(createCustomLibraryItemDraft(inputFor(text(), { description: "   " })))
      .not.toHaveProperty("description");
  });

  it("preserves a container-to-text composition and per-element selections", () => {
    const child = text("text-b");
    const root: PowerShowElement = {
      type: "container",
      id: "container-a",
      hidden: false,
      layout: { children: { direction: "column", gap: "12px" } },
      children: [child],
    };

    expect(createCustomLibraryItemDraft(inputFor(root, {
      selections: new Map([
        [root.id, new Set(["layout.children.gap"])],
        [child.id, new Set(["typography.fontSize"])],
      ]),
    })).root).toEqual({
      type: "container",
      properties: [{ path: "layout.children.gap", value: "12px" }],
      children: [{
        type: "text",
        properties: [{ path: "typography.fontSize", value: "46px" }],
      }],
    });
  });

  it("uses composition defaults for missing selections and preserves explicit empty selections", () => {
    const child = text("text-b");
    const root: PowerShowElement = {
      type: "container",
      id: "container-a",
      hidden: false,
      children: [child],
    };

    const item = createCustomLibraryItemDraft(inputFor(root, {
      selections: new Map([[root.id, new Set()]]),
    }));

    expect(item.root.properties).toEqual([]);
    expect(item.root.children?.[0]?.properties).toEqual([
      { path: "variant", value: "title" },
      { path: "typography.fontFamily", value: "Inter" },
      { path: "typography.fontSize", value: "46px" },
    ]);
  });

  it("returns only item metadata and resolved recipe, without ids or source context", () => {
    const item = createCustomLibraryItemDraft(inputFor(text("source-element")));
    const serialized = JSON.stringify(item);

    expect(Object.keys(item).sort()).toEqual(["name", "root"]);
    expect(serialized).not.toContain("source-element");
    expect(serialized).not.toMatch(/(?:presentation|slide|sourceElement|parent)Id/i);
    expect(serialized).not.toMatch(/(?:createdAt|updatedAt|savedAt|schemaVersion|recipeVersion|formatVersion)/i);
    expect(serialized).not.toMatch(/(?:selections|selectedPaths|defaultSelected|checkboxState|elementIds)/i);
  });

  it("does not mutate the root, selection map, or input metadata", () => {
    const root = text();
    const selections = new Map([[root.id, new Set(["typography"])] ]);
    const input = inputFor(root, { name: "  Widget  ", description: "  Description  ", selections });
    const beforeRoot = structuredClone(root);
    const beforeSelections = [...selections.get(root.id)!];
    const beforeInput = { ...input };

    createCustomLibraryItemDraft(input);

    expect(root).toEqual(beforeRoot);
    expect([...selections.get(root.id)!]).toEqual(beforeSelections);
    expect(input).toEqual(beforeInput);
  });

  it("isolates nested recipe property values from the source", () => {
    const root: PowerShowElement = {
      type: "table",
      id: "table-id",
      hidden: false,
      mode: "simple",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "PowerShow" }],
    };
    const item = createCustomLibraryItemDraft(inputFor(root, {
      selections: new Map([[root.id, new Set(["rows"])]]),
    }));
    const rows = item.root.properties[0]?.value as Array<Record<string, string>>;

    rows[0]!.name = "Recipe";

    expect(root.rows[0]).toEqual({ name: "PowerShow" });
  });

  it("omits children for a leaf recipe", () => {
    expect(createCustomLibraryItemDraft(inputFor()).root).not.toHaveProperty("children");
  });
});
