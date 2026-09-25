import { describe, expect, it } from "vitest";

import {
  LinkedContainerStyleSchema,
  LinkedCodeStyleSchema,
  LinkedDividerStyleSchema,
  LinkedSimpleTableStyleSchema,
  LinkedStructuredTableStyleSchema,
  LinkedTerminalStyleSchema,
  LinkedTopicsStyleSchema,
  PresentationSchema,
  removePresentationPaletteColor,
} from "../src";
import { defaultsInput } from "./fixtures/schema-fixtures";

const style = {
  id: "layout-card",
  name: " Card ",
  layout: { padding: 24 },
};

const container = (overrides: Record<string, unknown> = {}) => ({
  id: "container",
  type: "container" as const,
  children: [],
  ...overrides,
});

const presentation = (elements: unknown[], linkedStyles: unknown[] = [style]) => ({
  ...defaultsInput,
  linkedStyles,
  slides: [{ id: "slide", elements }],
});

describe("Linked Styles canonical definitions", () => {
  it("keeps Linked Styles optional for existing schemaVersion 1 documents", () => {
    const parsed = PresentationSchema.parse(defaultsInput);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed).not.toHaveProperty("linkedStyles");
  });

  it.each([
    { layout: { padding: 16 } },
    { style: { background: { color: "#112233" } } },
    { typography: { fontSize: 20 } },
    { effect: { opacity: 0.5 } },
  ])("accepts each shareable namespace", (namespace) => {
    expect(LinkedContainerStyleSchema.safeParse({ id: "shared", name: "Shared", ...namespace }).success).toBe(true);
  });

  it("trims identifiers and names while preserving duplicate names", () => {
    const parsed = PresentationSchema.parse(presentation([], [
      { id: " one ", name: " Shared ", layout: { children: { gap: 8 } } },
      { id: "two", name: "Shared", effect: { opacity: 0.5 } },
    ]));
    expect(parsed.linkedStyles).toMatchObject([
      { id: "one", name: "Shared" },
      { id: "two", name: "Shared" },
    ]);
  });

  it.each([
    { id: "style", name: "Style" },
    { id: "style", name: "Style", layout: {} },
    { id: "style", name: "Style", style: {} },
    { id: "style", name: "Style", typography: {} },
    { id: "style", name: "Style", effect: {} },
    { id: "style", name: "Style", layout: { children: {} } },
    { id: "style", name: "Style", style: { background: {} } },
  ])("rejects empty definitions", (definition) => {
    expect(LinkedContainerStyleSchema.safeParse(definition).success).toBe(false);
  });

  it.each([
    { id: "style", name: "Style", layout: { padding: 8 }, target: "container" },
    { id: "style", name: "Style", layout: { padding: 8 }, managedProperties: [] },
    { id: "style", name: "Style", style: { className: "card" } },
    { id: "style", name: "Style", hidden: false, layout: { padding: 8 } },
  ])("strictly rejects unsupported definition fields", (definition) => {
    expect(LinkedContainerStyleSchema.safeParse(definition).success).toBe(false);
  });

  it("requires unique definition IDs", () => {
    expect(PresentationSchema.safeParse(presentation([], [style, { ...style, name: "Other", effect: { opacity: 0.5 } }])).success).toBe(false);
  });

  it("accepts a typed Topics Linked Style and keeps schemaVersion 1", () => {
    const parsed = PresentationSchema.parse(presentation([], [{
      target: "topics",
      id: "topics-shared",
      name: "Topics",
      kind: "ordered",
      layout: { position: "absolute", top: 10 },
      rootMarkerStyle: "square",
      markerColor: "#ff0000",
      itemGap: 12,
    }]));
    expect(parsed.schemaVersion).toBe(1);
    expect(LinkedTopicsStyleSchema.safeParse(parsed.linkedStyles?.[0]).success).toBe(true);
    expect(parsed.linkedStyles?.[0]).toMatchObject({ kind: "ordered" });
  });

  it("rejects unsupported Topics Linked Style properties", () => {
    expect(LinkedTopicsStyleSchema.safeParse({
      target: "topics", id: "topics", name: "Topics", typography: { fontSize: 20 },
    }).success).toBe(false);
  });

  it("rejects cross-type Linked Style references", () => {
    const topics = { id: "topics", type: "topics", kind: "unordered", items: [], linkedStyleId: "container" };
    const containerWithTopics = container({ linkedStyleId: "topics" });
    expect(PresentationSchema.safeParse(presentation([topics], [{ target: "topics", id: "topics", name: "Topics", itemGap: 4 }])).success).toBe(false);
    expect(PresentationSchema.safeParse(presentation([containerWithTopics], [{ target: "topics", id: "topics", name: "Topics", itemGap: 4 }])).success).toBe(false);
  });

  it("rejects a missing Topics Linked Style reference", () => {
    expect(PresentationSchema.safeParse(presentation([
      { id: "topics", type: "topics", kind: "unordered", items: [], linkedStyleId: "missing" },
    ], [])).success).toBe(false);
  });
});

describe("Linked Style references", () => {
  it("accepts a Container reference and rejects a missing reference", () => {
    expect(PresentationSchema.safeParse(presentation([container({ linkedStyleId: "layout-card" })])).success).toBe(true);
    expect(PresentationSchema.safeParse(presentation([container({ linkedStyleId: "missing" })])).success).toBe(false);
  });

  it("validates recursive Container references", () => {
    expect(PresentationSchema.safeParse(presentation([
      container({ children: [container({ id: "nested", linkedStyleId: "missing" })] }),
    ])).success).toBe(false);
  });

  it("validates references in structured Table ContentSlots", () => {
    expect(PresentationSchema.safeParse(presentation([{
      id: "table",
      type: "table",
      mode: "structured",
      columns: [{ id: "column", header: { id: "header", children: [container({ linkedStyleId: "missing" })] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
    }])).success).toBe(false);
  });

  it("validates references in nested Topics ContentSlots", () => {
    expect(PresentationSchema.safeParse(presentation([{
      id: "topics",
      type: "topics",
      kind: "unordered",
      items: [{
        id: "topic",
        content: { id: "content", children: [] },
        children: [{
          id: "nested-topic",
          content: { id: "nested-content", children: [container({ linkedStyleId: "missing" })] },
          children: [],
        }],
      }],
    }])).success).toBe(false);
  });

  it.each([
    { id: "text", type: "text", content: "Text" },
    { id: "image", type: "image", src: "image.png" },
    {
      id: "table",
      type: "table",
      mode: "structured",
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
    },
  ])("rejects linkedStyleId on non-Container elements", (element) => {
    expect(PresentationSchema.safeParse(presentation([{ ...element, linkedStyleId: "layout-card" }])).success).toBe(false);
  });
});

describe("target-specific Linked Style contracts", () => {
  const targetSchemas = [
    ["Code", LinkedCodeStyleSchema, {
      target: "code", id: "code", name: "Code", layout: { width: "100%" },
      style: { color: "#112233" }, typography: { fontFamily: "monospace" }, effect: { opacity: 0.8 },
    }],
    ["Terminal", LinkedTerminalStyleSchema, {
      target: "terminal", id: "terminal", name: "Terminal", layout: { height: "20rem" },
      style: { commandColor: "#112233" }, typography: { fontSize: 14 },
      titleTypography: { fontWeight: 700 }, effect: { opacity: 0.8 },
    }],
    ["Simple Table", LinkedSimpleTableStyleSchema, {
      target: "table", mode: "simple", id: "simple-table", name: "Simple table",
      style: { color: "#112233" }, typography: { fontSize: 14 }, effect: { opacity: 0.8 },
    }],
    ["Structured Table", LinkedStructuredTableStyleSchema, {
      target: "table", mode: "structured", id: "structured-table", name: "Structured table",
      style: { headerBackground: "#112233" }, layout: { width: "100%" }, effect: { opacity: 0.8 },
    }],
    ["Divider", LinkedDividerStyleSchema, {
      target: "divider", id: "divider", name: "Divider",
      style: { background: { color: "#112233" } }, effect: { opacity: 0.8 },
    }],
  ] as const;

  it.each(targetSchemas)("accepts the permitted namespaces for %s", (_label, schema, definition) => {
    expect(schema.safeParse(definition).success).toBe(true);
  });

  it.each([
    [LinkedCodeStyleSchema, { target: "code", id: "code", name: "Code" }],
    [LinkedTerminalStyleSchema, { target: "terminal", id: "terminal", name: "Terminal" }],
    [LinkedSimpleTableStyleSchema, { target: "table", mode: "simple", id: "table", name: "Table" }],
    [LinkedStructuredTableStyleSchema, { target: "table", mode: "structured", id: "table", name: "Table" }],
    [LinkedDividerStyleSchema, { target: "divider", id: "divider", name: "Divider" }],
  ] as const)("rejects empty definitions", (schema, definition) => {
    expect(schema.safeParse(definition).success).toBe(false);
  });

  it.each([
    [LinkedCodeStyleSchema, { target: "code", id: "code", name: "Code", style: { className: "runtime" } }],
    [LinkedTerminalStyleSchema, { target: "terminal", id: "terminal", name: "Terminal", style: { className: "runtime" } }],
    [LinkedSimpleTableStyleSchema, { target: "table", mode: "simple", id: "table", name: "Table", style: { className: "runtime" } }],
    [LinkedStructuredTableStyleSchema, { target: "table", mode: "structured", id: "table", name: "Table", style: { className: "runtime" } }],
    [LinkedDividerStyleSchema, { target: "divider", id: "divider", name: "Divider", style: { className: "runtime" } }],
  ] as const)("rejects runtime class hooks", (schema, definition) => {
    expect(schema.safeParse(definition).success).toBe(false);
  });

  it.each([
    [LinkedCodeStyleSchema, { target: "code", id: "code", name: "Code", style: { color: "#112233" }, code: "content" }],
    [LinkedTerminalStyleSchema, { target: "terminal", id: "terminal", name: "Terminal", style: { color: "#112233" }, lines: [] }],
    [LinkedSimpleTableStyleSchema, { target: "table", mode: "simple", id: "table", name: "Table", style: { color: "#112233" }, columns: [], rows: [] }],
    [LinkedStructuredTableStyleSchema, { target: "table", mode: "structured", id: "table", name: "Table", style: { headerBackground: "#112233" }, showHeader: true }],
    [LinkedDividerStyleSchema, { target: "divider", id: "divider", name: "Divider", style: { background: { color: "#112233" } }, orientation: "horizontal" }],
  ] as const)("rejects content and local configuration", (schema, definition) => {
    expect(schema.safeParse(definition).success).toBe(false);
  });

  it("keeps legacy Container and Topics definitions unchanged", () => {
    expect(LinkedContainerStyleSchema.safeParse({ id: "container", name: "Container", layout: { padding: 4 } }).success).toBe(true);
    expect(LinkedContainerStyleSchema.safeParse({ id: "container", name: "Container", target: "container", layout: { padding: 4 } }).success).toBe(false);
    expect(LinkedTopicsStyleSchema.safeParse({ target: "topics", id: "topics", name: "Topics", itemGap: 4 }).success).toBe(true);
  });
});

describe("target-specific Linked Style references", () => {
  const targetStyles = [
    { target: "code", id: "code-style", name: "Code", style: { color: "#112233" } },
    { target: "terminal", id: "terminal-style", name: "Terminal", style: { commandColor: "#112233" } },
    { target: "table", mode: "simple", id: "simple-table-style", name: "Simple table", typography: { fontSize: 14 } },
    { target: "table", mode: "structured", id: "structured-table-style", name: "Structured table", style: { headerBackground: "#112233" } },
    { target: "divider", id: "divider-style", name: "Divider", style: { background: { color: "#112233" } } },
  ] as const;

  const elementFor = (target: string, linkedStyleId: string): Record<string, unknown> => {
    if (target === "code") return { id: "code", type: "code", code: "const x = 1", linkedStyleId };
    if (target === "terminal") return { id: "terminal", type: "terminal", lines: [], linkedStyleId };
    if (target === "divider") return { id: "divider", type: "divider", linkedStyleId };
    if (linkedStyleId === "simple-table-style") {
      return { id: "simple-table", type: "table", columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], linkedStyleId };
    }
    return {
      id: "structured-table", type: "table", mode: "structured", linkedStyleId,
      columns: [{ id: "column", header: { id: "header", children: [] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
    };
  };

  it.each(targetStyles)("accepts a same-target $target reference", (style) => {
    expect(PresentationSchema.safeParse(presentation([elementFor(style.target, style.id)], [style])).success).toBe(true);
  });

  it("rejects missing and cross-target references, including Table modes", () => {
    for (const style of targetStyles) {
      for (const other of targetStyles) {
        const element = elementFor(style.target, other.id);
        const expected = style.target === other.target &&
          (style.target !== "table" || ("mode" in style && "mode" in other && style.mode === other.mode));
        expect(PresentationSchema.safeParse(presentation([element], [style])).success).toBe(expected);
      }
    }
    expect(PresentationSchema.safeParse(presentation([elementFor("code", "missing")], [])).success).toBe(false);
  });

  it("continues validating target references in Root Definitions and localRootChildren", () => {
    const result = PresentationSchema.safeParse({
      ...defaultsInput,
      linkedStyles: [{ target: "code", id: "code-style", name: "Code", style: { color: "#112233" } }],
      rootDefinitions: [{
        id: "root",
        name: "Root",
        localChildTargetIds: ["target"],
        root: { id: "root-container", type: "container", children: [elementFor("code", "code-style"), { id: "target", type: "container", children: [] }] },
      }],
      slides: [{ id: "slide", elements: [], rootDefinitionId: "root", localRootChildren: [{ targetContainerId: "target", children: [elementFor("code", "missing")] }] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("Linked Style palette integrity", () => {
  const reference = { kind: "palette" as const, colorId: "accent" };
  const linked = {
    id: "palette-card",
    name: "Palette card",
    style: {
      color: reference,
      background: { color: reference, gradient: { type: "linear" as const, stops: [{ color: reference, position: 0 }, { color: "#000000", position: 100 }] } },
      border: { width: 1, color: reference },
    },
    typography: { textDecorationColor: reference, textStroke: { width: 1, color: reference } },
    effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
  };

  it("validates palette references in every color-bearing Linked Style namespace", () => {
    expect(PresentationSchema.safeParse({
      ...presentation([], [linked]),
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    }).success).toBe(true);
    expect(PresentationSchema.safeParse({
      ...presentation([], [linked]),
      palette: { colors: [{ id: "other", name: "Other", value: "#facc15" }] },
    }).success).toBe(false);
  });

  it("materializes Linked Style palette references before removal", () => {
    const parsed = PresentationSchema.parse({
      ...presentation([], [linked]),
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    });
    const result = removePresentationPaletteColor(parsed, "accent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detachedCount).toBe(7);
    expect(result.presentation.linkedStyles?.[0]).toMatchObject({
      style: { color: "#facc15", background: { color: "#facc15" }, border: { color: "#facc15" } },
      typography: { textDecorationColor: "#facc15", textStroke: { color: "#facc15" } },
      effect: { shadow: { color: "#facc15" } },
    });
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
  });

  it("round-trips canonical Linked Styles through JSON", () => {
    const canonical = PresentationSchema.parse({
      ...presentation([container({ linkedStyleId: "palette-card" })], [linked]),
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    });
    expect(PresentationSchema.parse(JSON.parse(JSON.stringify(canonical)))).toEqual(canonical);
  });

  it("validates palette references in Linked Topics markerColor", () => {
    const topics = { target: "topics", id: "topics-palette", name: "Topics", markerColor: reference };
    expect(PresentationSchema.safeParse({
      ...presentation([], [topics]),
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    }).success).toBe(true);
    expect(PresentationSchema.safeParse({
      ...presentation([], [topics]),
      palette: { colors: [{ id: "other", name: "Other", value: "#facc15" }] },
    }).success).toBe(false);
  });

  it("detaches Linked Topics markerColor when removing its palette", () => {
    const parsed = PresentationSchema.parse({
      ...presentation([], [{ target: "topics", id: "topics-palette", name: "Topics", markerColor: reference }]),
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    });
    const result = removePresentationPaletteColor(parsed, "accent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detachedCount).toBe(1);
    expect(result.presentation.linkedStyles?.[0]).toMatchObject({ markerColor: "#facc15" });
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
  });
});

describe("target-specific Linked Style palette integrity", () => {
  const reference = { kind: "palette" as const, colorId: "accent" };
  const linkedStyles = [
    {
      target: "code" as const,
      id: "code-palette",
      name: "Code",
      style: {
        color: reference,
        background: { gradient: { type: "linear" as const, stops: [{ color: reference, position: 0 }, { color: "#000000", position: 100 }] } },
        border: { width: 1, color: reference },
      },
      effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
    },
    {
      target: "terminal" as const,
      id: "terminal-palette",
      name: "Terminal",
      style: {
        commandColor: reference,
        promptColor: reference,
        outputColor: reference,
        commentColor: reference,
        errorColor: reference,
        background: { color: reference },
        border: { width: 1, gradient: { type: "linear" as const, stops: [{ color: reference, position: 0 }, { color: "#000000", position: 100 }] } },
      },
      effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
    },
    {
      target: "table" as const,
      mode: "simple" as const,
      id: "simple-table-palette",
      name: "Simple table",
      style: { color: reference, background: { color: reference }, border: { width: 1, color: reference } },
      effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
    },
    {
      target: "table" as const,
      mode: "structured" as const,
      id: "structured-table-palette",
      name: "Structured table",
      style: { background: { color: reference }, headerBackground: reference, bodyRowAlternateBackground: reference },
      effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
    },
    {
      target: "divider" as const,
      id: "divider-palette",
      name: "Divider",
      style: { background: { gradient: { type: "linear" as const, stops: [{ color: reference, position: 0 }, { color: "#000000", position: 100 }] } } },
    },
  ];

  it("validates and materializes target-specific palette references", () => {
    const parsed = PresentationSchema.parse({
      ...presentation([], linkedStyles),
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    });
    const result = removePresentationPaletteColor(parsed, "accent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detachedCount).toBe(21);
    expect(result.presentation.linkedStyles?.find((style) => style.id === "terminal-palette")).toMatchObject({
      style: { commandColor: "#facc15", promptColor: "#facc15", errorColor: "#facc15", background: { color: "#facc15" } },
    });
    expect(result.presentation.linkedStyles?.find((style) => style.id === "structured-table-palette")).toMatchObject({
      style: { headerBackground: "#facc15", bodyRowAlternateBackground: "#facc15" },
    });
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
  });

  it("rejects missing palette references in target-specific fields", () => {
    expect(PresentationSchema.safeParse({
      ...presentation([], [{ target: "terminal", id: "terminal", name: "Terminal", style: { commandColor: reference } }]),
      palette: { colors: [{ id: "other", name: "Other", value: "#facc15" }] },
    }).success).toBe(false);
    expect(PresentationSchema.safeParse({
      ...presentation([], [{ target: "table", mode: "structured", id: "table", name: "Table", style: { headerBackground: reference } }]),
      palette: { colors: [{ id: "other", name: "Other", value: "#facc15" }] },
    }).success).toBe(false);
  });
});
