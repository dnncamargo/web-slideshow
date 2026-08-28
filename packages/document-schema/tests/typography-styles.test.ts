import { describe, expect, it } from "vitest";

import {
  CustomTypographyStyleSchema,
  FundamentalTypographyStyleOverrideSchema,
  hasLocalTypographyStyleProperties,
  PresentationSchema,
  TypographyStylePropertiesSchema,
  TypographyStylesSchema,
  resolveTextTypography,
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

describe("Typography Styles canonical definitions", () => {
  const presentation = (element: unknown, typographyStyles?: unknown[]) => ({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    slides: [{ id: "slide", elements: [element] }],
    ...(typographyStyles ? { typographyStyles } : {}),
  });

  const text = (overrides: Record<string, unknown> = {}) => ({
    id: "text",
    type: "text",
    content: "Text",
    ...overrides,
  });

  it("keeps presentation typography styles optional", () => {
    expect(PresentationSchema.safeParse(defaultsInput).success).toBe(true);
  });

  it("accepts a fundamental override with properties", () => {
    expect(
      FundamentalTypographyStyleOverrideSchema.safeParse({
        id: "body",
        typography: { fontFamily: "Inter" },
      }).success,
    ).toBe(true);
  });

  it("rejects empty fundamental overrides and extra fields", () => {
    expect(
      FundamentalTypographyStyleOverrideSchema.safeParse({
        id: "body",
        typography: {},
      }).success,
    ).toBe(false);
    expect(
      FundamentalTypographyStyleOverrideSchema.safeParse({
        id: "body",
        name: "Body",
        typography: { fontFamily: "Inter" },
      }).success,
    ).toBe(false);
    expect(
      FundamentalTypographyStyleOverrideSchema.safeParse({
        id: "body",
        role: "body",
        typography: { fontFamily: "Inter" },
      }).success,
    ).toBe(false);
  });

  it("accepts custom styles with and without properties", () => {
    expect(
      CustomTypographyStyleSchema.safeParse({
        id: "quote",
        name: "Quote",
        role: "body",
        typography: allTypographyProperties,
      }).success,
    ).toBe(true);
    expect(
      CustomTypographyStyleSchema.safeParse({
        id: "quote",
        name: "Quote",
        role: "body",
        typography: {},
      }).success,
    ).toBe(true);
  });

  it("rejects invalid custom IDs and names", () => {
    for (const id of ["title", "subtitle", "body", "caption"]) {
      expect(
        CustomTypographyStyleSchema.safeParse({
          id,
          name: "Style",
          role: "body",
          typography: {},
        }).success,
      ).toBe(false);
    }

    expect(
      CustomTypographyStyleSchema.safeParse({
        id: "quote",
        name: "   ",
        role: "body",
        typography: {},
      }).success,
    ).toBe(false);
  });

  it("enforces unique IDs across fundamental and custom styles", () => {
    expect(
      TypographyStylesSchema.safeParse([
        { id: "quote", name: "Quote", role: "body", typography: {} },
        { id: "quote", name: "Another Quote", role: "body", typography: {} },
      ]).success,
    ).toBe(false);
    expect(
      TypographyStylesSchema.safeParse([
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

  it("identifies only local typography properties as independent", () => {
    expect(hasLocalTypographyStyleProperties(undefined)).toBe(false);
    expect(hasLocalTypographyStyleProperties({})).toBe(false);
    expect(hasLocalTypographyStyleProperties({ textStroke: { width: 1, color: "#000000" } })).toBe(false);
    expect(hasLocalTypographyStyleProperties({ textDecorationColor: "#000000" })).toBe(false);
    expect(hasLocalTypographyStyleProperties({ textStroke: { width: 1, color: "#000000" }, textDecorationColor: "#000000" })).toBe(false);

    for (const property of Object.keys(allTypographyProperties)) {
      expect(hasLocalTypographyStyleProperties({ [property]: allTypographyProperties[property as keyof typeof allTypographyProperties] })).toBe(true);
    }

    expect(hasLocalTypographyStyleProperties({ lineHeight: 1.5, textStroke: { width: 1, color: "#000000" } })).toBe(true);
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

  it("validates custom references and local-property ownership", () => {
    const style = { id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic" } };
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote" }), [style])).success).toBe(true);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "missing" }))).success).toBe(false);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote", typography: { fontFamily: "Arial" } }), [style])).success).toBe(false);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote", typography: { textStroke: { width: 1, color: "#fff" } } }), [style])).success).toBe(true);
    expect(PresentationSchema.safeParse(presentation(text({ variant: "quote", typography: { textDecorationColor: "#fff" } }), [style])).success).toBe(true);
  });

  it("validates nested custom variants", () => {
    const nested = { id: "container", type: "container", children: [text({ variant: "missing" })] };
    expect(PresentationSchema.safeParse(presentation(nested)).success).toBe(false);
  });

  it("resolves linked, independent, and custom typography without style inheritance", () => {
    const styles = [
      { id: "body", typography: { fontFamily: "Inter" } },
      { id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic" } },
    ];
    const linked = PresentationSchema.parse(presentation(text({ variant: "body", typography: { textStroke: { width: 1, color: "#fff" } } }), styles));
    expect(resolveTextTypography(linked, linked.slides[0]!.elements[0] as Extract<typeof linked.slides[0]['elements'][number], { type: 'text' }>).typography).toMatchObject({ fontFamily: "Inter", textStroke: { width: 1, color: "#ffffff" } });

    const independent = PresentationSchema.parse(presentation(text({ variant: "body", typography: { fontFamily: "Fira Code" } }), styles));
    expect(resolveTextTypography(independent, independent.slides[0]!.elements[0] as Extract<typeof independent.slides[0]['elements'][number], { type: 'text' }>).typography).toMatchObject({ fontFamily: "Fira Code" });

    const custom = PresentationSchema.parse(presentation(text({ variant: "quote", typography: { textDecorationColor: "#fff" } }), styles));
    const resolved = resolveTextTypography(custom, custom.slides[0]!.elements[0] as Extract<typeof custom.slides[0]['elements'][number], { type: 'text' }>);
    expect(resolved).toMatchObject({ role: "body", typography: { fontStyle: "italic", textDecorationColor: "#ffffff" } });
    expect(resolved.typography).not.toHaveProperty("fontFamily");
  });
});
