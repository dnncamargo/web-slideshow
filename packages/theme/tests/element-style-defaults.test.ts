import { describe, expect, it } from "vitest";

import {
  resolveEffectiveElementStyleDefaults,
  resolveEffectiveNumericStyleValue,
} from "../src/element-style-defaults";

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
      resolveEffectiveElementStyleDefaults({ type: "container" })
        .borderRadius,
    ).toBe(0);
    expect(
      resolveEffectiveElementStyleDefaults({ type: "code" }).borderRadius,
    ).toBe(14);
    expect(
      resolveEffectiveElementStyleDefaults({ type: "terminal" }).borderRadius,
    ).toBe(14);
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
