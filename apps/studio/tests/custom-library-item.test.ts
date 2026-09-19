import { describe, expect, it } from "vitest";

import type { FontResource, PresentationElement } from "@web-slideshow/document-schema";

import {
  createCustomLibraryItemDraft,
  type CreateCustomLibraryItemDraftInput,
} from "../src/features/custom-library/custom-library-item";
import { snapshotCustomLibraryStyleDependencies } from "../src/features/custom-library/custom-library-style-dependencies";

const text = (id = "text-1"): PresentationElement => ({
  type: "text",
  id,
  hidden: false,
  content: "Presentation title",
  variant: "title",
  typography: { fontFamily: "Inter", fontSize: "46px" },
});

const inputFor = (
  root: PresentationElement = text(),
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
    const direct = text() as Extract<PresentationElement, { type: "text" }>;
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

  it("captures selected custom Text Style definitions and their transitive fonts", () => {
    const custom = text() as Extract<PresentationElement, { type: "text" }>;
    custom.variant = "example";
    const draft = createCustomLibraryItemDraft(inputFor(custom, {
      selections: new Map([["text-1", new Set(["variant"])] ]),
      textStyles: [{ id: "example", name: "Example", role: "body", typography: { fontFamily: "Fira Code" } }],
      fontResources,
    }));

    expect(draft.dependencies?.textStyles).toEqual([
      { id: "example", name: "Example", role: "body", typography: { fontFamily: "Fira Code" } },
    ]);
    expect(draft.dependencies?.fonts?.map((font) => font.family)).toEqual(["Fira Code"]);
  });

  it("does not capture fundamental variants", () => {
    const draft = createCustomLibraryItemDraft(inputFor(text(), {
      selections: new Map([["text-1", new Set(["variant"])] ]),
      textStyles: [{ id: "body", name: "Body override", role: "body", typography: { fontSize: 20 } }],
    }));

    expect(draft.dependencies).toBeUndefined();
  });

  it("rejects an unresolved custom variant during capture", () => {
    const custom = text() as Extract<PresentationElement, { type: "text" }>;
    custom.variant = "missing";

    expect(() => createCustomLibraryItemDraft(inputFor(custom, {
      selections: new Map([["text-1", new Set(["variant"])] ]),
    }))).toThrow("Unresolved custom text style dependency: missing");
  });

  it.each([
    { type: "container" as const, linkedStyle: { id: "card", name: "Card", layout: { padding: 8 }, typography: { fontFamily: "Fira Code" } } },
    { type: "topics" as const, linkedStyle: { target: "topics" as const, id: "topics-style", name: "Topics", kind: "ordered" as const, itemGap: 8 } },
  ])("captures a $type Linked Style", ({ type, linkedStyle }) => {
    const root: PresentationElement = type === "container"
      ? { type, id: "root", hidden: false, linkedStyleId: linkedStyle.id, children: [] }
      : { type, id: "root", hidden: false, linkedStyleId: linkedStyle.id, items: [] };
    const draft = createCustomLibraryItemDraft(inputFor(root, {
      selections: new Map([["root", new Set(["linkedStyleId"])] ]),
      linkedStyles: [linkedStyle],
      fontResources,
    }));

    expect(draft.dependencies?.linkedStyles).toEqual([linkedStyle]);
    if (type === "container") expect(draft.dependencies?.fonts?.map((font) => font.family)).toEqual(["Fira Code"]);
  });

  it("captures a custom variant inside a Topics bounded payload", () => {
    const topicText = text("topic-text") as Extract<PresentationElement, { type: "text" }>;
    topicText.variant = "example";
    const topics: PresentationElement = {
      type: "topics", id: "topics", hidden: false, kind: "unordered",
      items: [{ id: "topic", content: { id: "slot", children: [topicText] }, children: [] }],
    };
    const draft = createCustomLibraryItemDraft(inputFor(topics, {
      selections: new Map([["topics", new Set(["items"])]]),
      textStyles: [{ id: "example", name: "Example", role: "body" }],
    }));

    expect(draft.dependencies?.textStyles).toEqual([
      { id: "example", name: "Example", role: "body" },
    ]);
  });

  it("captures a custom variant inside a Structured Table bounded payload once", () => {
    const headerText = text("header-text") as Extract<PresentationElement, { type: "text" }>;
    headerText.variant = "example";
    const table: PresentationElement = {
      type: "table", id: "table", hidden: false, mode: "structured", showHeader: true,
      columns: [{ id: "column", header: { id: "header", children: [headerText] } }],
      rows: [],
    };
    const draft = createCustomLibraryItemDraft(inputFor(table, {
      selections: new Map([["table", new Set(["columns"])]]),
      textStyles: [{ id: "example", name: "Example", role: "body" }],
    }));

    expect(draft.dependencies?.textStyles).toEqual([
      { id: "example", name: "Example", role: "body" },
    ]);
  });

  it("literalizes palette colors inside a captured Linked Style", () => {
    const root: PresentationElement = { type: "container", id: "root", hidden: false, linkedStyleId: "card", children: [] };
    const draft = createCustomLibraryItemDraft(inputFor(root, {
      selections: new Map([["root", new Set(["linkedStyleId"])]]),
      linkedStyles: [{ id: "card", name: "Card", style: { color: { kind: "palette", colorId: "accent" } } }],
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    }));

    expect(draft.dependencies?.linkedStyles?.[0]?.style?.color).toBe("#facc15");
    expect(JSON.stringify(draft.dependencies?.linkedStyles)).not.toContain('"kind":"palette"');
  });

  it("captures references in recipe children once", () => {
    const first = text("first") as Extract<PresentationElement, { type: "text" }>;
    const second = text("second") as Extract<PresentationElement, { type: "text" }>;
    first.variant = "example";
    second.variant = "example";
    const root: PresentationElement = { type: "container", id: "root", hidden: false, children: [first, second] };

    const draft = createCustomLibraryItemDraft(inputFor(root, {
      selections: new Map([
        ["root", new Set<string>()],
        ["first", new Set(["variant"])],
        ["second", new Set(["variant"])],
      ]),
      textStyles: [{ id: "example", name: "Example", role: "body" }],
    }));

    expect(draft.dependencies?.textStyles).toHaveLength(1);
  });

  it("rejects an unresolved Linked Style during capture", () => {
    const root: PresentationElement = { type: "container", id: "root", hidden: false, linkedStyleId: "missing", children: [] };

    expect(() => createCustomLibraryItemDraft(inputFor(root, {
      selections: new Map([["root", new Set(["linkedStyleId"])] ]),
      linkedStyles: [],
    }))).toThrow("Unresolved linked style dependency: missing");
  });

  it("converts palette references in captured definitions to literal values", () => {
    const custom = text() as Extract<PresentationElement, { type: "text" }>;
    custom.variant = "example";
    const draft = createCustomLibraryItemDraft(inputFor(custom, {
      selections: new Map([["text-1", new Set(["variant"])] ]),
      textStyles: [{ id: "example", name: "Example", role: "body", style: { color: { kind: "palette", colorId: "accent" } } }],
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    }));

    expect(draft.dependencies?.textStyles?.[0]?.style?.color).toBe("#facc15");
    expect(JSON.stringify(draft)).not.toContain('"kind":"palette"');
  });

  it("omits dependencies for unselected or unregistered families", () => {
    expect(createCustomLibraryItemDraft(inputFor(text(), {
      selections: new Map([["text-1", new Set(["variant"])] ]),
      fontResources,
    }))).not.toHaveProperty("dependencies");

    const unregistered = text() as Extract<PresentationElement, { type: "text" }>;
    unregistered.typography = { fontFamily: "Arial" };
    expect(createCustomLibraryItemDraft(inputFor(unregistered, {
      selections: new Map([["text-1", new Set(["typography.fontFamily"])] ]),
      fontResources,
    }))).not.toHaveProperty("dependencies");
  });

  it("recurses through nested recipes, deduplicates normalized families, and converts legacy fonts", () => {
    const first = text("first") as Extract<PresentationElement, { type: "text" }>;
    first.typography = { fontFamily: " fira code " };
    const second = text("second") as Extract<PresentationElement, { type: "text" }>;
    second.typography = { fontFamily: "Inter" };
    const third = text("third") as Extract<PresentationElement, { type: "text" }>;
    third.typography = { fontFamily: "FIRA CODE" };
    const root: PresentationElement = { type: "container", id: "root", hidden: false, children: [first, second, third] };

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

    expect(snapshotCustomLibraryStyleDependencies(topicRecipe, fontResources)).toEqual({ fonts: [{ family: "Fira Code", faces: fontResources[0]!.faces }] });
    expect(snapshotCustomLibraryStyleDependencies(tableRecipe, fontResources)).toEqual({ fonts: [{ family: "Inter", faces: [{ source: fontResources[1]!.source! }] }] });
  });

  it("does not scan arbitrary payloads for fontFamily", () => {
    const interactive: PresentationElement = {
      type: "interactive",
      id: "interactive",
      hidden: false,
      widget: "function-plot",
      config: { typography: { fontFamily: "Fira Code" } },
    } as PresentationElement;

    expect(createCustomLibraryItemDraft(inputFor(interactive, {
      selections: new Map([["interactive", new Set(["config"])] ]),
      fontResources,
    }))).not.toHaveProperty("dependencies");
  });

  it("keeps source FontResources immutable and snapshots nested face values", () => {
    const sourceFonts: FontResource[] = structuredClone(fontResources);
    const beforeFonts = structuredClone(sourceFonts);
    const direct = text() as Extract<PresentationElement, { type: "text" }>;
    direct.typography = { fontFamily: "Fira Code" };
    const draft = createCustomLibraryItemDraft(inputFor(direct, {
      selections: new Map([["text-1", new Set(["typography.fontFamily"])]]),
      fontResources: sourceFonts,
    }));
    const snapshot = draft.dependencies!.fonts![0]!;
    snapshot.faces[0]!.source.url = "https://example.com/changed.woff2";

    expect(sourceFonts).toEqual(beforeFonts);
    expect(sourceFonts[0]!.faces![0]!.source.url).toBe("https://example.com/fira.woff2");
  });

  it("captures Fonts from canonical Topics and structured Table builders", () => {
    const topicText = text("topic-text") as Extract<PresentationElement, { type: "text" }>;
    topicText.typography = { fontFamily: "Fira Code" };
    const topics: PresentationElement = {
      type: "topics", id: "topics", hidden: false, kind: "unordered",
      items: [{ id: "topic-item", content: { id: "slot", children: [topicText] }, children: [] }],
    };
    const topicDraft = createCustomLibraryItemDraft(inputFor(topics, {
      selections: new Map([["topics", new Set(["items"])]]), fontResources,
    }));

    const tableText = text("table-text") as Extract<PresentationElement, { type: "text" }>;
    tableText.typography = { fontFamily: "Fira Code" };
    const table: PresentationElement = {
      type: "table", id: "table", hidden: false, mode: "structured", showHeader: true,
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [tableText] }] }],
    };
    const tableDraft = createCustomLibraryItemDraft(inputFor(table, {
      selections: new Map([["table", new Set(["rows"])]]), fontResources,
    }));

    expect(topicDraft.dependencies?.fonts?.map((font) => font.family)).toEqual(["Fira Code"]);
    expect(tableDraft.dependencies?.fonts?.map((font) => font.family)).toEqual(["Fira Code"]);
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
    const root: PresentationElement = {
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
    const root: PresentationElement = {
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
    const root: PresentationElement = {
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
