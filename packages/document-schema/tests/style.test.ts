import { describe, expect, it } from "vitest";

import { ElementStyleSchema } from "../src/style";

describe("ElementStyleSchema typography", () => {
  it("keeps typography optional for existing documents", () => {
    expect(ElementStyleSchema.parse({})).toEqual({});
  });

  it("accepts an explicit font family and trims its value", () => {
    expect(ElementStyleSchema.parse({ fontFamily: " Source Sans 3 " })).toEqual({
      fontFamily: "Source Sans 3",
    });
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
