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
});
