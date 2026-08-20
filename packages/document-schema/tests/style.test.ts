import { describe, expect, it } from "vitest";

import { ElementStyleSchema } from "../src/style";

describe("ElementStyleSchema typography", () => {
  it("keeps typography optional for existing documents", () => {
    expect(ElementStyleSchema.parse({})).toEqual({});
  });

  it("accepts an explicit font family and trims its value", () => {
    expect(ElementStyleSchema.parse({ fontFamily: " Source Sans 3 " })).toEqual(
      {
        fontFamily: "Source Sans 3",
      },
    );
  });

  it.each([
    ["numeric font size", { fontSize: 32 }],
    ["string font size", { fontSize: "2.5rem" }],
    ["font weight 400", { fontWeight: 400 }],
    ["font weight 700", { fontWeight: 700 }],
    ["normal font style", { fontStyle: "normal" }],
    ["italic font style", { fontStyle: "italic" }],
    ["left text alignment", { textAlign: "left" }],
    ["center text alignment", { textAlign: "center" }],
    ["right text alignment", { textAlign: "right" }],
    ["justified text alignment", { textAlign: "justify" }],
    ["unit line height", { lineHeight: 1 }],
    ["fractional line height", { lineHeight: 1.5 }],
    ["positive letter spacing", { letterSpacing: 2 }],
    ["negative letter spacing", { letterSpacing: -1 }],
  ])("accepts %s", (_name, style) => {
    expect(ElementStyleSchema.safeParse(style).success).toBe(true);
  });

  it("accepts all canonical font weight increments", () => {
    for (let fontWeight = 100; fontWeight <= 900; fontWeight += 100) {
      expect(ElementStyleSchema.safeParse({ fontWeight }).success).toBe(true);
    }
  });

  it("accepts combined typography overrides", () => {
    expect(
      ElementStyleSchema.safeParse({
        fontFamily: "Inter",
        fontSize: 48,
        fontWeight: 600,
        fontStyle: "italic",
        textAlign: "center",
        lineHeight: 1.3,
        letterSpacing: 1,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["none transform", { textTransform: "none" }],
    ["uppercase transform", { textTransform: "uppercase" }],
    ["lowercase transform", { textTransform: "lowercase" }],
    ["capitalize transform", { textTransform: "capitalize" }],
    ["normal whitespace", { whiteSpace: "normal" }],
    ["nowrap whitespace", { whiteSpace: "nowrap" }],
    ["pre-line whitespace", { whiteSpace: "pre-line" }],
    ["pre-wrap whitespace", { whiteSpace: "pre-wrap" }],
    ["auto text-wrap-style", { textWrapStyle: "auto" }],
    ["balance text-wrap-style", { textWrapStyle: "balance" }],
    ["pretty text-wrap-style", { textWrapStyle: "pretty" }],
    ["normal overflow-wrap", { overflowWrap: "normal" }],
    ["break-word overflow-wrap", { overflowWrap: "break-word" }],
    ["anywhere overflow-wrap", { overflowWrap: "anywhere" }],
    ["none decoration", { textDecorationLine: "none" }],
    ["underline decoration", { textDecorationLine: "underline" }],
    ["overline decoration", { textDecorationLine: "overline" }],
    ["line-through decoration", { textDecorationLine: "line-through" }],
    ["decoration color", { textDecorationColor: "#f8fafc" }],
  ])("accepts %s", (_name, style) => {
    expect(ElementStyleSchema.safeParse(style).success).toBe(true);
  });

  it("accepts a combined text-capability style", () => {
    expect(
      ElementStyleSchema.safeParse({
        textTransform: "uppercase",
        whiteSpace: "pre-wrap",
        textWrapStyle: "balance",
        overflowWrap: "break-word",
        textDecorationLine: "underline",
        textDecorationColor: "#f8fafc",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid text decoration color", () => {
    expect(
      ElementStyleSchema.safeParse({
        textDecorationColor: 123,
      }).success,
    ).toBe(false);
  });

  it("round-trips text-capability properties through the schema", () => {
    expect(
      ElementStyleSchema.parse({
        textTransform: "uppercase",
        whiteSpace: "pre-line",
        textWrapStyle: "pretty",
        overflowWrap: "anywhere",
        textDecorationLine: "line-through",
        textDecorationColor: "#f8fafc",
      }),
    ).toEqual({
      textTransform: "uppercase",
      whiteSpace: "pre-line",
      textWrapStyle: "pretty",
      overflowWrap: "anywhere",
      textDecorationLine: "line-through",
      textDecorationColor: "#f8fafc",
    });
  });

  it("accepts auto as the canonical wrap-style default value", () => {
    expect(ElementStyleSchema.parse({ textWrapStyle: "auto" })).toEqual({
      textWrapStyle: "auto",
    });
  });

  it("rejects the CSS text-wrap shorthand value wrap", () => {
    expect(
      ElementStyleSchema.safeParse({ textWrapStyle: "wrap" }).success,
    ).toBe(false);
  });

  it.each([
    ["camelCase transform", { textTransform: "upperCase" }],
    ["padded whitespace", { whiteSpace: " pre-wrap " }],
    ["unknown text-wrap-style", { textWrapStyle: "wrap" }],
    ["unknown overflow-wrap", { overflowWrap: "break-all" }],
    ["unknown decoration", { textDecorationLine: "strike" }],
  ])("rejects %s", (_name, style) => {
    expect(ElementStyleSchema.safeParse(style).success).toBe(false);
  });

  it.each([
    ["font weight 350", { fontWeight: 350 }],
    ["font weight 950", { fontWeight: 950 }],
    ["oblique font style", { fontStyle: "oblique" }],
    ["middle text alignment", { textAlign: "middle" }],
    ["zero line height", { lineHeight: 0 }],
    ["negative line height", { lineHeight: -1 }],
  ])("rejects %s", (_name, style) => {
    expect(ElementStyleSchema.safeParse(style).success).toBe(false);
  });
});

describe("ElementStyleSchema text stroke", () => {
  it("keeps text stroke optional for existing documents", () => {
    expect(ElementStyleSchema.parse({})).toEqual({});

    expect(
      ElementStyleSchema.safeParse({ textStroke: undefined }).success,
    ).toBe(true);
  });

  it("accepts a text stroke with a length and color", () => {
    expect(
      ElementStyleSchema.parse({
        textStroke: {
          width: "0.125rem",
          color: "#0f172a",
        },
      }),
    ).toEqual({
      textStroke: {
        width: "0.125rem",
        color: "#0f172a",
      },
    });
  });

  it.each([
    ["missing width", { textStroke: { color: "#0f172a" } }],
    ["missing color", { textStroke: { width: 1 } }],
    ["empty color", { textStroke: { width: 1, color: "" } }],
  ])("rejects %s", (_name, style) => {
    expect(ElementStyleSchema.safeParse(style).success).toBe(false);
  });
});
