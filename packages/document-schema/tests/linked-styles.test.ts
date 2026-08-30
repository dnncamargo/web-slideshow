import { describe, expect, it } from "vitest";

import {
  LinkedContainerStyleSchema,
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
});
