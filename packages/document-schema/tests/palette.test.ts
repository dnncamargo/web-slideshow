import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ColorValueSchema,
  PaletteColorReferenceSchema,
  PresentationPaletteSchema,
  PresentationSchema,
  isPaletteColorReference,
  resolveColorValue,
} from "../src";

import {
  defaultsInput,
} from "./fixtures/schema-fixtures";

describe("palette schemas", () => {
  const validPalette = {
    colors: [
      {
        id: "accent",
        name: " Accent ",
        value: "#FACC15",
      },
    ],
  };

  it("accepts identifiable palette colors and normalizes their values", () => {
    const result = PresentationPaletteSchema.parse(validPalette);

    expect(result.colors[0]).toEqual({
      id: "accent",
      name: "Accent",
      value: "#facc15",
    });
  });

  it("accepts empty and optional palettes", () => {
    expect(PresentationPaletteSchema.safeParse({ colors: [] }).success).toBe(true);
    expect(PresentationSchema.parse(defaultsInput)).not.toHaveProperty("palette");
  });

  it.each([
    { colors: ["#fff"] },
    { colors: [{ id: "accent", name: "Accent", value: "#fff", extra: true }] },
    { colors: [{ id: "", name: "Accent", value: "#fff" }] },
    { colors: [{ id: "accent", name: " ", value: "#fff" }] },
    {
      colors: [
        { id: "accent", name: "Accent", value: "#fff" },
        { id: "accent", name: "Other", value: "#000" },
      ],
    },
  ])("rejects invalid palette $colors", (palette) => {
    expect(PresentationPaletteSchema.safeParse(palette).success).toBe(false);
  });
});

describe("ColorValue", () => {
  it("accepts literal colors and palette references", () => {
    expect(ColorValueSchema.safeParse("rgba(1, 2, 3, 0.5)").success).toBe(true);
    expect(
      PaletteColorReferenceSchema.safeParse({
        kind: "palette",
        colorId: "accent",
      }).success,
    ).toBe(true);
  });

  it("does not allow palette references as palette entry values", () => {
    expect(
      PresentationPaletteSchema.safeParse({
        colors: [{ id: "accent", name: "Accent", value: { kind: "palette", colorId: "other" } }],
      }).success,
    ).toBe(false);
  });

  it.each([
    { kind: "palette", colorId: "" },
    { kind: "palette", colorId: "accent", extra: true },
    { kind: "other", colorId: "accent" },
  ])("rejects malformed palette references", (reference) => {
    expect(PaletteColorReferenceSchema.safeParse(reference).success).toBe(false);
    expect(ColorValueSchema.safeParse(reference).success).toBe(false);
  });
});

describe("palette color resolution", () => {
  const palette = PresentationPaletteSchema.parse({
    colors: [{ id: "accent", name: "Accent", value: "#FACC15" }],
  });

  it("identifies references without treating literal colors as references", () => {
    expect(isPaletteColorReference("#fff")).toBe(false);
    expect(isPaletteColorReference({ kind: "palette", colorId: "accent" })).toBe(true);
  });

  it("resolves literals and local ids", () => {
    expect(resolveColorValue("#facc15", palette)).toBe("#facc15");
    expect(resolveColorValue({ kind: "palette", colorId: "accent" }, palette)).toBe("#facc15");
    expect(resolveColorValue({ kind: "palette", colorId: "missing" }, palette)).toBeUndefined();
    expect(resolveColorValue({ kind: "palette", colorId: "Accent" }, palette)).toBeUndefined();
    expect(resolveColorValue({ kind: "palette", colorId: "accent" }, undefined)).toBeUndefined();
  });

  it.each([
    {
      name: "simple table effect",
      element: {
        id: "simple-table",
        type: "table" as const,
        hidden: false,
        mode: "simple" as const,
        columns: [{ key: "name", label: "Name" }],
        rows: [{ name: "PowerShow" }],
        effect: { shadow: { x: 0, y: 1, blur: 2, color: { kind: "palette" as const, colorId: "missing" } } },
      },
      path: ["slides", 0, "elements", 0, "effect", "shadow", "color", "colorId"],
    },
    {
      name: "structured table effect",
      element: {
        id: "structured-table",
        type: "table" as const,
        hidden: false,
        mode: "structured" as const,
        columns: [{ id: "column", header: { id: "header", children: [] } }],
        rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
        effect: { shadow: { x: 0, y: 1, blur: 2, color: { kind: "palette" as const, colorId: "missing" } } },
      },
      path: ["slides", 0, "elements", 0, "effect", "shadow", "color", "colorId"],
    },
    {
      name: "blocks effect",
      element: {
        id: "blocks",
        type: "blocks" as const,
        hidden: false,
        source: "",
        effect: { shadow: { x: 0, y: 1, blur: 2, color: { kind: "palette" as const, colorId: "missing" } } },
      },
      path: ["slides", 0, "elements", 0, "effect", "shadow", "color", "colorId"],
    },
  ])("rejects unresolved references in $name at the exact colorId path", ({ element, path }) => {
    const result = PresentationSchema.safeParse({
      ...defaultsInput,
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
      slides: [{ id: "slide", elements: [element] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => JSON.stringify(issue.path) === JSON.stringify(path))).toBe(true);
    }
  });

  it.each(["table", "blocks"] as const)("accepts a local $type effect reference", (type) => {
    const reference = { kind: "palette" as const, colorId: "accent" };
    const element = type === "table"
      ? {
          id: "table",
          type: "table" as const,
          mode: "simple" as const,
          columns: [{ key: "name", label: "Name" }],
          rows: [{ name: "PowerShow" }],
          effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
        }
      : {
          id: "blocks",
          type: "blocks" as const,
          source: "",
          effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
        };

    expect(PresentationSchema.safeParse({
      ...defaultsInput,
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
      slides: [{ id: "slide", elements: [element] }],
    }).success).toBe(true);
  });

});

describe("presentation palette reference integrity", () => {
  it.each([
    ["style.color", { style: { color: { kind: "palette", colorId: "missing" } } }, ["textStyles", 0, "style", "color", "colorId"]],
    ["decoration color", { typography: { textDecorationColor: { kind: "palette", colorId: "missing" } } }, ["textStyles", 0, "typography", "textDecorationColor", "colorId"]],
    ["stroke color", { typography: { textStroke: { width: 1, color: { kind: "palette", colorId: "missing" } } } }, ["textStyles", 0, "typography", "textStroke", "color", "colorId"]],
  ] as const)("rejects unresolved Text Style %s", (_name, style, path) => {
    const result = PresentationSchema.safeParse({
      ...defaultsInput,
      palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
      textStyles: [{ id: "body", ...style }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => JSON.stringify(issue.path) === JSON.stringify(path))).toBe(true);
  });
  const reference = { kind: "palette" as const, colorId: "accent" };
  const baseSlide = { id: "linked-slide", title: "", summary: "", speakerNotes: "" };
  const presentation = {
    ...defaultsInput,
    palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    slides: [{
      ...baseSlide,
      elements: [{
        id: "linked-text",
        type: "text" as const,
        content: { type: "rich-text" as const, runs: [{ text: "linked", marks: { color: reference } }] },
        style: {
          color: reference,
          background: { gradient: { type: "linear" as const, stops: [
            { color: reference, position: 0 },
            { color: "#000000", position: 100 },
          ] } },
          border: { width: 1, color: reference },
        },
        typography: { textDecorationColor: reference, textStroke: { width: 1, color: reference } },
        effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
      }],
      background: { color: reference },
    }],
  };

  it("accepts local references across structured paint positions", () => {
    expect(PresentationSchema.safeParse(presentation).success).toBe(true);
  });

  it("rejects missing palettes, missing ids, and name-only matches", () => {
    expect(PresentationSchema.safeParse({ ...presentation, palette: undefined }).success).toBe(false);
    expect(PresentationSchema.safeParse({ ...presentation, palette: { colors: [{ id: "other", name: "accent", value: "#facc15" }] } }).success).toBe(false);
    expect(PresentationSchema.safeParse({ ...presentation, slides: [{ ...baseSlide, background: { color: { kind: "palette", colorId: "missing" } } }] }).success).toBe(false);
  });

  it("does not inspect unconstrained interactive or scripted payloads", () => {
    const payload = { kind: "palette", colorId: "missing" };
    expect(PresentationSchema.safeParse({ ...defaultsInput, slides: [{ ...baseSlide, elements: [
      { id: "interactive", type: "interactive" as const, widget: "function-plot" as const, config: { payload } },
      { id: "scripted", type: "scripted" as const, title: "Script", html: JSON.stringify(payload) },
    ] }] }).success).toBe(true);
  });
});
