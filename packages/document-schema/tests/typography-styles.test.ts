import { describe, expect, it } from "vitest";

import {
  CustomTypographyStyleSchema,
  FundamentalTypographyStyleOverrideSchema,
  hasLocalTypographyStyleProperties,
  PresentationSchema,
  TypographyStylePropertiesSchema,
  TypographyStylesSchema,
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
});
