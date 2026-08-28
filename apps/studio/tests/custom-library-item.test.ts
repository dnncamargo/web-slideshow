import { describe, expect, it } from "vitest";

import type { FontResource, PowerShowElement } from "@powershow/document-schema";

import {
  createCustomLibraryItemDraft,
  type CreateCustomLibraryItemDraftInput,
} from "../src/features/custom-library/custom-library-item";
import { snapshotCustomLibraryStyleFontDependencies } from "../src/features/custom-library/custom-library-style-dependencies";

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
  const fontResources: FontResource[] = [
    {
      id: "font-fira",
      family: "Fira Code",
      faces: [{ weight: 400, style: "normal" as const, source: { type: "url" as const, url: "https://example.com/fira.woff2", format: "woff2" as const } }],
    },
    {
      id: "font-inter",
      family: "Inter",
      source: { type: "url" as const, url: "https://example.com/inter.woff2", format: "woff2" as const },
    },
  ];

  it("snapshots selected direct font dependencies with complete faces", () => {
    const direct = text() as Extract<PowerShowElement, { type: "text" }>;
    direct.typography = { fontFamily: "Fira Code" };
    const draft = createCustomLibraryItemDraft(inputFor(direct, {
      selections: new Map([["text-1", new Set(["typography.fontFamily"])] ]),
      fontResources,
    }));

    expect(draft.dependencies).toEqual({
      fonts: [{
        family: "Fira Code",
        faces: fontResources[0]!.faces,
      }],
    });
    expect(draft.dependencies?.fonts?.[0]).not.toHaveProperty("id");
  });

  it("omits dependencies for unselected or unregistered families", () => {
    expect(createCustomLibraryItemDraft(inputFor(text(), {
      selections: new Map([["text-1", new Set(["variant"])] ]),
      fontResources,
    }))).not.toHaveProperty("dependencies");

    const unregistered = text() as Extract<PowerShowElement, { type: "text" }>;
    unregistered.typography = { fontFamily: "Arial" };
    expect(createCustomLibraryItemDraft(inputFor(unregistered, {
      selections: new Map([["text-1", new Set(["typography.fontFamily"])] ]),
      fontResources,
    }))).not.toHaveProperty("dependencies");
  });

  it("recurses through nested recipes, deduplicates normalized families, and converts legacy fonts", () => {
    const first = text("first") as Extract<PowerShowElement, { type: "text" }>;
    first.typography = { fontFamily: " fira code " };
    const second = text("second") as Extract<PowerShowElement, { type: "text" }>;
    second.typography = { fontFamily: "Inter" };
    const third = text("third") as Extract<PowerShowElement, { type: "text" }>;
    third.typography = { fontFamily: "FIRA CODE" };
    const root: PowerShowElement = { type: "container", id: "root", hidden: false, children: [first, second, third] };

    const draft = createCustomLibraryItemDraft(inputFor(root, {
      selections: new Map([
        ["root", new Set<string>()],
        ["first", new Set(["typography.fontFamily"])],
        ["second", new Set(["typography.fontFamily"])],
        ["third", new Set(["typography.fontFamily"])],
      ]),
      fontResources: [fontResources[1]!, { id: "legacy", family: "Fira Code", source: fontResources[0]!.faces![0]!.source }],
    }));

    expect(draft.dependencies?.fonts).toEqual([
      { family: "Fira Code", faces: [{ source: fontResources[0]!.faces![0]!.source }] },
      { family: "Inter", faces: [{ source: fontResources[1]!.source! }] },
    ]);
  });

  it("discovers fonts in bounded Topics and structured Table payloads", () => {
    const topicRecipe = {
      type: "topics" as const,
      properties: [{
        path: "items",
        value: [{ content: { typography: {}, children: [{ type: "text", typography: { fontFamily: "Fira Code" } }] }, children: [] }],
      }],
    };
    const tableRecipe = {
      type: "table" as const,
      properties: [{
        path: "rows",
        value: [{ cells: [{ typography: { fontFamily: "Inter" }, children: [] }] }],
      }],
    };

    expect(snapshotCustomLibraryStyleFontDependencies(topicRecipe, fontResources)).toEqual({ fonts: [{ family: "Fira Code", faces: fontResources[0]!.faces }] });
    expect(snapshotCustomLibraryStyleFontDependencies(tableRecipe, fontResources)).toEqual({ fonts: [{ family: "Inter", faces: [{ source: fontResources[1]!.source! }] }] });
  });

  it("does not scan arbitrary payloads for fontFamily", () => {
    const interactive: PowerShowElement = {
      type: "interactive",
      id: "interactive",
      hidden: false,
      widget: "function-plot",
      config: { typography: { fontFamily: "Fira Code" } },
    } as PowerShowElement;

    expect(createCustomLibraryItemDraft(inputFor(interactive, {
      selections: new Map([["interactive", new Set(["config"])] ]),
      fontResources,
    }))).not.toHaveProperty("dependencies");
  });

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
