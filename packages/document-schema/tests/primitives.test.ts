import { describe, expect, it } from "vitest";

import {
  ColorSchema,
  colorToPickerHex,
  formatColorAsHex,
  formatColorAsRgba,
  parseColor,
  replaceColorRgb,
} from "../src/primitives";

describe("ColorSchema", () => {
  it.each(["#fff", "#ffff", "#7c3aed", "#7c3aed80"]) (
    "accepts %s",
    (color) => {
      expect(ColorSchema.safeParse(color).success).toBe(true);
    },
  );

  it.each(["rgba(124, 58, 237, 1)", "rgba(124, 58, 237, 0.5)"]) (
    "accepts %s",
    (color) => {
      expect(ColorSchema.safeParse(color).success).toBe(true);
    },
  );

  it("normalizes accepted rgba whitespace", () => {
    expect(ColorSchema.parse(" rgba(124,58,237,.5) ")).toBe(
      "rgba(124, 58, 237, 0.5)",
    );
  });

  it.each([
    "rgba(256, 58, 237, 1)",
    "rgba(-1, 58, 237, 1)",
    "rgba(124, 58, 237, 1.1)",
    "rgba(124, 58, 237, -0.1)",
    "rgba(124, 58, 237)",
    "hsl(260, 83%, 58%)",
  ])("rejects %s", (color) => {
    expect(ColorSchema.safeParse(color).success).toBe(false);
  });
});

describe("color helpers", () => {
  it("parses short HEX values", () => {
    expect(parseColor("#fff")).toEqual({
      red: 255,
      green: 255,
      blue: 255,
      alpha: 1,
    });
    expect(parseColor("#ffff")).toEqual({
      red: 255,
      green: 255,
      blue: 255,
      alpha: 1,
    });
  });

  it("converts opaque HEX and RGBA", () => {
    const color = parseColor("#7c3aed");

    expect(color).toBeDefined();
    expect(formatColorAsRgba(color!)).toBe("rgba(124, 58, 237, 1)");
    expect(formatColorAsHex(parseColor("rgba(124, 58, 237, 1)")!)).toBe(
      "#7c3aed",
    );
  });

  it("converts transparent HEX and RGBA", () => {
    expect(formatColorAsHex(parseColor("rgba(124, 58, 237, 0.5)")!)).toBe(
      "#7c3aed80",
    );
    expect(formatColorAsRgba(parseColor("#7c3aed80")!)).toBe(
      "rgba(124, 58, 237, 0.5)",
    );
  });

  it("preserves alpha when replacing picker RGB", () => {
    expect(colorToPickerHex("rgba(124, 58, 237, 0.5)")).toBe("#7c3aed");
    expect(
      replaceColorRgb("rgba(124, 58, 237, 0.5)", "#ffffff", "rgba"),
    ).toBe("rgba(255, 255, 255, 0.5)");
  });
});
