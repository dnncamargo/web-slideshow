import { describe, expect, it } from "vitest";

import {
  convertAuthoringLength,
  normalizeAuthoringLengthValue,
  parseAuthoringLength,
  resolveEffectiveElementStyleDefaults,
  resolveEffectiveNumericStyleValue,
  TOPICS_ITEM_GAP_DEFAULT_PX,
} from "../src/element-style-defaults";

describe("authoring length conversions", () => {
  it("parses numeric pixels and supported string lengths", () => {
    expect(parseAuthoringLength(48)).toEqual({ value: 48, unit: "px" });
    expect(parseAuthoringLength("3rem")).toEqual({ value: 3, unit: "rem" });
    expect(parseAuthoringLength("0.025em")).toEqual({
      value: 0.025,
      unit: "em",
    });
  });

  it("converts pixels and rem from the deterministic root basis", () => {
    expect(convertAuthoringLength(48, "rem")).toBe(3);
    expect(convertAuthoringLength("3rem", "px")).toBe(48);
    expect(convertAuthoringLength(18, "rem")).toBe(1.125);
  });

  it("converts letter spacing to em from the effective font size", () => {
    expect(convertAuthoringLength(-1.2, "em", 48)).toBe(-0.025);
  });

  it("converts letter spacing back from em to pixels", () => {
    expect(convertAuthoringLength("-0.025em", "px", 48)).toBe(-1.2);
  });

  it("round-trips a negative explicit value across units", () => {
    expect(convertAuthoringLength("-1.2px", "rem")).toBe(-0.075);
    expect(convertAuthoringLength("-0.075rem", "px")).toBe(-1.2);
  });

  it("normalizes converted values to four decimal places", () => {
    expect(normalizeAuthoringLengthValue(0.333333333333)).toBe(0.3333);
  });
});

describe("element style authoring defaults", () => {
  it("resolves inherited typography for every text variant", () => {
    expect(
      resolveEffectiveElementStyleDefaults({ type: "text", variant: "title" }),
    ).toEqual({
      typography: {
        fontSize: 48,
        lineHeight: 1.08,
        letterSpacing: -1.2,
      },
      borderRadius: 0,
    });
    expect(
      resolveEffectiveElementStyleDefaults({
        type: "text",
        variant: "subtitle",
      }),
    ).toEqual({
      typography: {
        fontSize: 28,
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      borderRadius: 0,
    });
    expect(
      resolveEffectiveElementStyleDefaults({ type: "text", variant: "body" }),
    ).toEqual({
      typography: {
        fontSize: 18,
        lineHeight: 1.6,
        letterSpacing: 0,
      },
      borderRadius: 0,
    });
    expect(
      resolveEffectiveElementStyleDefaults({
        type: "text",
        variant: "caption",
      }),
    ).toEqual({
      typography: {
        fontSize: 14,
        lineHeight: 1.45,
        letterSpacing: 0,
      },
      borderRadius: 0,
    });
  });

  it("resolves the Textbox typography defaults", () => {
    expect(resolveEffectiveElementStyleDefaults({ type: "textbox" })).toEqual({
      typography: {
        fontSize: 16.8,
        lineHeight: 1.65,
        letterSpacing: 0,
      },
      borderRadius: 0,
    });
  });

  it("resolves canonical rounded-corner defaults by element type", () => {
    expect(
      resolveEffectiveElementStyleDefaults({ type: "container" }).borderRadius,
    ).toBe(0);
    expect(
      resolveEffectiveElementStyleDefaults({ type: "code" }).borderRadius,
    ).toBe(14);
    expect(
      resolveEffectiveElementStyleDefaults({ type: "terminal" }).borderRadius,
    ).toBe(14);
    expect(
      resolveEffectiveElementStyleDefaults({ type: "topics" }).borderRadius,
    ).toBe(0);
    expect(
      resolveEffectiveElementStyleDefaults({ type: "divider" }).borderRadius,
    ).toBe(0);
  });
  it("exposes the deterministic Topics item gap default", () => {
    expect(TOPICS_ITEM_GAP_DEFAULT_PX).toBe(6);
  });
});

describe("effective numeric authoring values", () => {
  it("uses the inherited value until an explicit override exists", () => {
    expect(resolveEffectiveNumericStyleValue(undefined, 48)).toEqual({
      value: 48,
      inherited: true,
    });
    expect(resolveEffectiveNumericStyleValue(52, 48)).toEqual({
      value: 52,
      inherited: false,
    });
  });

  it("tracks a variant change only while the value is inherited", () => {
    const title = resolveEffectiveElementStyleDefaults({
      type: "text",
      variant: "title",
    });
    const body = resolveEffectiveElementStyleDefaults({
      type: "text",
      variant: "body",
    });

    expect(
      resolveEffectiveNumericStyleValue(
        undefined,
        title.typography?.fontSize ?? 0,
      ).value,
    ).toBe(48);
    expect(
      resolveEffectiveNumericStyleValue(
        undefined,
        body.typography?.fontSize ?? 0,
      ).value,
    ).toBe(18);
    expect(
      resolveEffectiveNumericStyleValue(52, body.typography?.fontSize ?? 0)
        .value,
    ).toBe(52);
  });

  it("returns to the current inherited value after reset", () => {
    expect(resolveEffectiveNumericStyleValue(1.8, 1.6)).toEqual({
      value: 1.8,
      inherited: false,
    });
    expect(resolveEffectiveNumericStyleValue(undefined, 1.6)).toEqual({
      value: 1.6,
      inherited: true,
    });
  });
});
