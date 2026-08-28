import { describe, expect, it } from "vitest";

import {
  CustomTextStyleSchema,
  FundamentalTextStyleOverrideSchema,
  hasLocalTypographyFields,
  stripLocalTypographyFields,
  PresentationSchema,
  TypographyStylePropertiesSchema,
  TextStyleTypographyPropertiesSchema,
  TextStyleVisualPropertiesSchema,
  TextStylesSchema,
  resolveTextStyle,
  TextElementSchema,
} from "../src";

import { defaultsInput } from "./fixtures/schema-fixtures";

const allTypographyProperties = {
  fontFamily: "Inter",
  fontSize: 24,
  fontWeight: 700,
  fontStyle: "italic",
  textAlign: "center",
  lineHeight: 1.5,
  letterSpacing: 1,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  textWrapStyle: "balance",
  overflowWrap: "anywhere",
  textDecorationLine: "underline",
} as const;

describe("Text Styles canonical definitions", () => {
  const presentation = (element: unknown, textStyles?: unknown[]) => ({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    slides: [{ id: "slide", elements: [element] }],
    ...(textStyles ? { textStyles } : {}),
  });

  const text = (overrides: Record<string, unknown> = {}) => ({
    id: "text",
    type: "text",
    content: "Text",
    ...overrides,
  });

  it("keeps presentation typography styles optional", () => {
    expect(PresentationSchema.safeParse(defaultsInput).success).toBe(true);
    expect(PresentationSchema.safeParse({ ...defaultsInput, typographyStyles: [] }).success).toBe(false);
    expect(PresentationSchema.safeParse({ ...defaultsInput, slides: [{ id: "slide", elements: [text({ typographyDetached: true })] }] }).success).toBe(false);
  });

  it("accepts a fundamental override with properties", () => {
    expect(
      FundamentalTextStyleOverrideSchema.safeParse({
        id: "body",
        typography: { fontFamily: "Inter" },
      }).success,
    ).toBe(true);
  });

  it("accepts sparse R2 visual and typography ownership", () => {
    expect(FundamentalTextStyleOverrideSchema.safeParse({ id: "body", style: { color: "#ff0000" } }).success).toBe(true);
    expect(CustomTextStyleSchema.safeParse({ id: "quote", name: "Quote", role: "body", style: { color: { kind: "palette", colorId: "primary" } } }).success).toBe(true);
    expect(TextStyleTypographyPropertiesSchema.safeParse({ textDecorationColor: "#00ff00" }).success).toBe(true);
    expect(TextStyleTypographyPropertiesSchema.safeParse({ textStroke: { width: 2, color: { kind: "palette", colorId: "outline" } } }).success).toBe(true);
    expect(TextStyleVisualPropertiesSchema.safeParse({}).success).toBe(true);
    expect(CustomTextStyleSchema.safeParse({ id: "quote", name: "Quote", role: "body", style: {} }).success).toBe(false);
    expect(CustomTextStyleSchema.safeParse({ id: "quote", name: "Quote", role: "body", typography: {} }).success).toBe(false);
    expect(CustomTextStyleSchema.safeParse({ id: "quote", name: "Quote", role: "body", style: { background: {} } }).success).toBe(false);
  });

  it("rejects every persisted fundamental empty-bag combination", () => {
    for (const value of [
      { id: "body", style: {} },
      { id: "body", typography: {} },
      { id: "body", style: {}, typography: { fontFamily: "Inter" } },
      { id: "body", style: { color: "#ff0000" }, typography: {} },
    ]) {
      expect(FundamentalTextStyleOverrideSchema.safeParse(value).success).toBe(false);
    }
    expect(FundamentalTextStyleOverrideSchema.safeParse({
      id: "body",
      style: { color: "#ff0000" },
      typography: { textDecorationLine: "underline" },
    }).success).toBe(true);
  });

  it("rejects empty fundamental overrides and extra fields", () => {
    expect(
      FundamentalTextStyleOverrideSchema.safeParse({
        id: "body",
        typography: {},
      }).success,
    ).toBe(false);
    expect(
      FundamentalTextStyleOverrideSchema.safeParse({
        id: "body",
        name: "Body",
        typography: { fontFamily: "Inter" },
      }).success,
    ).toBe(false);
    expect(
      FundamentalTextStyleOverrideSchema.safeParse({
        id: "body",
        role: "body",
        typography: { fontFamily: "Inter" },
      }).success,
    ).toBe(false);
  });

  it("accepts custom styles with or without properties and rejects empty bags", () => {
    expect(
      CustomTextStyleSchema.safeParse({
        id: "quote",
        name: "Quote",
        role: "body",
        typography: allTypographyProperties,
      }).success,
    ).toBe(true);
    expect(
      CustomTextStyleSchema.safeParse({
        id: "quote",
        name: "Quote",
        role: "body",

      }).success,
    ).toBe(true);
    expect(
      CustomTextStyleSchema.safeParse({
        id: "quote",
        name: "Quote",
        role: "body",
        typography: {},
      }).success,
    ).toBe(false);
  });

  it("rejects invalid custom IDs and names", () => {
    for (const id of ["title", "subtitle", "body", "caption"]) {
      expect(
        CustomTextStyleSchema.safeParse({
          id,
          name: "Style",
          role: "body",
          typography: {},
        }).success,
      ).toBe(false);
    }

    expect(
      CustomTextStyleSchema.safeParse({
        id: "quote",
        name: "   ",
        role: "body",
        typography: {},
      }).success,
    ).toBe(false);
  });

  it("enforces unique IDs across fundamental and custom styles", () => {
    expect(
      TextStylesSchema.safeParse([
        { id: "quote", name: "Quote", role: "body", typography: {} },
        { id: "quote", name: "Another Quote", role: "body", typography: {} },
      ]).success,
    ).toBe(false);
    expect(
      TextStylesSchema.safeParse([
        { id: "body", typography: { fontFamily: "Inter" } },
        { id: "body", typography: { fontSize: 20 } },
      ]).success,
    ).toBe(false);
  });

  it("accepts all twelve V1 fields and rejects visual or extra fields", () => {
    expect(TypographyStylePropertiesSchema.safeParse(allTypographyProperties).success).toBe(true);

    for (const value of [
      { color: "#ffffff" },
      { textDecorationColor: "#ffffff" },
      { textStroke: { width: 1, color: "#ffffff" } },
      { background: {} },
      { border: {} },
      { effect: {} },
      { layout: {} },
      { unsupported: true },
    ]) {
      expect(TypographyStylePropertiesSchema.safeParse(value).success).toBe(false);
    }
  });

  it("identifies only local typography style properties", () => {
    expect(hasLocalTypographyFields(undefined)).toBe(false);
    expect(hasLocalTypographyFields({})).toBe(false);
    expect(hasLocalTypographyFields({ textStroke: { width: 1, color: "#000000" } })).toBe(false);
    expect(hasLocalTypographyFields({ textDecorationColor: "#000000" })).toBe(false);
    expect(hasLocalTypographyFields({ textStroke: { width: 1, color: "#000000" }, textDecorationColor: "#000000" })).toBe(false);

    for (const property of Object.keys(allTypographyProperties)) {
      expect(hasLocalTypographyFields({ [property]: allTypographyProperties[property as keyof typeof allTypographyProperties] })).toBe(true);
    }

    expect(hasLocalTypographyFields({ lineHeight: 1.5, textStroke: { width: 1, color: "#000000" } })).toBe(true);
  });

  it("uses one canonical fundamental variant source and defaults to body", () => {
    for (const variant of ["title", "subtitle", "body", "caption"]) {
      expect(PresentationSchema.safeParse(presentation(text({ variant }))).success).toBe(true);
    }
    const parsed = PresentationSchema.parse(presentation(text()));
    expect(parsed.slides[0]?.elements[0]).toMatchObject({ variant: "body" });
    expect(TextElementSchema.parse(text({ variant: "  quote  " })).variant).toBe("quote");
    expect(TextElementSchema.safeParse(text({ variant: "   " })).success).toBe(false);
  });

  it("validates custom references and detached state", () => {
    const style = { id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic" } };
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote" }), [style])).success).toBe(true);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "missing" }))).success).toBe(false);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote", typography: { fontFamily: "Arial" } }), [style])).success).toBe(true);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote", typography: { textStroke: { width: 1, color: "#fff" } } }), [style])).success).toBe(true);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote", typography: { textDecorationColor: "#fff" } }), [style])).success).toBe(true);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote", styleDetached: true }), [style])).success).toBe(false);
    expect(TextElementSchema.safeParse(text({ styleDetached: false })).success).toBe(false);
  });

  it("validates nested custom variants", () => {
    const nested = { id: "container", type: "container", children: [text({ variant: "missing" })] };
    expect(PresentationSchema.safeParse(presentation(nested)).success).toBe(false);
  });

  it("resolves attached and detached typography with property-level overrides", () => {
    const styles = [
      { id: "body", typography: { fontFamily: "Inter", fontSize: 18, fontWeight: 400 } },
      { id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic" } },
    ];
    const linked = PresentationSchema.parse(presentation(text({ variant: "body", typography: { fontSize: 22, textStroke: { width: 1, color: "#fff" }, textDecorationColor: "#000" } }), styles));
    expect(resolveTextStyle(linked, linked.slides[0]!.elements[0] as Extract<typeof linked.slides[0]['elements'][number], { type: 'text' }>).typography).toMatchObject({ fontFamily: "Inter", fontSize: 22, fontWeight: 400, textStroke: { width: 1, color: "#ffffff" }, textDecorationColor: "#000000" });

    const detached = PresentationSchema.parse(presentation(text({ variant: "body", styleDetached: true, typography: { fontSize: 22 } }), styles));
    expect(resolveTextStyle(detached, detached.slides[0]!.elements[0] as Extract<typeof detached.slides[0]['elements'][number], { type: 'text' }>).typography).toEqual({ fontSize: 22 });

    const custom = PresentationSchema.parse(presentation(text({ variant: "quote", typography: { fontSize: 24, textDecorationColor: "#fff" } }), styles));
    const resolved = resolveTextStyle(custom, custom.slides[0]!.elements[0] as Extract<typeof custom.slides[0]['elements'][number], { type: 'text' }>);
    expect(resolved).toMatchObject({ role: "body", typography: { fontStyle: "italic", fontSize: 24, textDecorationColor: "#ffffff" } });
    expect(resolved.typography).not.toHaveProperty("fontFamily");
  });

  it("resolves Text Style visual ownership with local precedence and preserves palette refs", () => {
    const palette = { colors: [{ id: "primary", name: "Primary", value: "#ff0000" }] };
    const styles = [{ id: "body", style: { color: { kind: "palette", colorId: "primary" } }, typography: { textDecorationColor: { kind: "palette", colorId: "primary" } } }];
    const linked = PresentationSchema.parse({ ...presentation(text({ style: { color: "#00ff00" }, typography: { textStroke: { width: 2, color: { kind: "palette", colorId: "primary" } } } }), styles), palette });
    const resolved = resolveTextStyle(linked, linked.slides[0]!.elements[0] as Extract<typeof linked.slides[0]['elements'][number], { type: 'text' }>);
    expect(resolved.style.color).toBe("#00ff00");
    expect(resolved.typography.textDecorationColor).toEqual({ kind: "palette", colorId: "primary" });
    expect(resolved.typography.textStroke?.color).toEqual({ kind: "palette", colorId: "primary" });
  });

  it("round-trips a representative canonical Text Style document without changing its semantics", () => {
    const reference = { kind: "palette", colorId: "primary" } as const;
    const canonical = PresentationSchema.parse({
      schemaVersion: 1,
      id: "round-trip",
      title: "Round trip",
      palette: {
        colors: [
          { id: "primary", name: "Primary", value: "#336699" },
          { id: "outline", name: "Outline", value: "#111111" },
        ],
      },
      resources: {
        fonts: [{
          id: "fira-code",
          family: "Fira Code",
          faces: [{
            weight: 400,
            style: "normal",
            subset: "latin",
            source: { type: "url", url: "https://example.com/fira-code.woff2" },
          }],
        }],
      },
      textStyles: [
        {
          id: "body",
          style: { color: reference },
          typography: {
            fontFamily: "Fira Code",
            fontSize: "1.25rem",
            fontWeight: 500,
            fontStyle: "italic",
            textAlign: "center",
            lineHeight: 1.5,
            letterSpacing: 1,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            textWrapStyle: "balance",
            overflowWrap: "anywhere",
            textDecorationLine: "underline",
            textDecorationColor: reference,
            textStroke: { width: "2px", color: { kind: "palette", colorId: "outline" } },
          },
        },
        { id: "quote", name: "Quote", role: "body", style: { color: "#abcdef" } },
      ],
      slides: [{
        id: "slide",
        elements: [
          { id: "attached", type: "text", variant: "body", content: "Attached", style: { color: "#ffffff", borderRadius: 4 }, typography: { fontSize: 22 } },
          { id: "detached", type: "text", variant: "body", styleDetached: true, content: "Detached", style: { color: reference }, typography: { fontFamily: "Fira Code", textDecorationColor: reference, textStroke: { width: "2px", color: { kind: "palette", colorId: "outline" } } } },
          { id: "custom", type: "text", variant: "quote", content: "Custom", hidden: true },
        ],
      }],
    });

    const reloaded = PresentationSchema.parse(JSON.parse(JSON.stringify(canonical)));

    expect(reloaded).toEqual(canonical);
    expect(reloaded.schemaVersion).toBe(1);
  });
});

describe("local typography style properties", () => {
  it("strips only V1 style fields and preserves element-only fields", () => {
    expect(stripLocalTypographyFields({
      fontSize: 22,
      fontWeight: 700,
      textStroke: { width: 1, color: "#ffffff" },
      textDecorationColor: "#ff0000",
    })).toEqual({
      textStroke: { width: 1, color: "#ffffff" },
      textDecorationColor: "#ff0000",
    });
    expect(stripLocalTypographyFields({ fontSize: 22 })).toBeUndefined();
    expect(stripLocalTypographyFields(undefined)).toBeUndefined();
  });
});

describe("effectively empty fundamental overrides", () => {
  it("rejects undefined-only typography", () => {
    expect(FundamentalTextStyleOverrideSchema.safeParse({ id: "body", typography: { fontFamily: undefined } }).success).toBe(false);
  });
});
