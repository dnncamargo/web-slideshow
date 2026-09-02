import { describe, expect, it } from "vitest";

import {
  BackgroundPatternSchema,
  BorderSchema,
  GradientSchema,
} from "../src/visual";
import {
  BlocksElementSchema,
  DividerElementSchema,
  ScriptedElementSchema,
} from "../src/elements";

const dotPattern =
  "radial-gradient(#444CF7 1.5px, transparent 1.5px)";

describe("BackgroundPatternSchema", () => {
  it("parses a minimal gradient pattern", () => {
    expect(BackgroundPatternSchema.parse({ image: dotPattern })).toEqual({
      image: dotPattern,
    });
  });

  it("parses MagicPattern-style multi-gradient images", () => {
    const image =
      "radial-gradient(#444CF7 1.5px, transparent 1.5px), radial-gradient(#444CF7 1.5px, #E5E5F7 1.5px)";

    expect(BackgroundPatternSchema.safeParse({ image }).success).toBe(true);
  });

  it.each([
    "linear-gradient(45deg, #fff, #000)",
    "radial-gradient(circle, #fff, #000)",
    "repeating-linear-gradient(45deg, #fff 0 10px, #000 10px 20px)",
    "repeating-radial-gradient(circle, #fff 0 10px, #000 10px 20px)",
  ])("accepts supported gradient pattern syntax: %s", (image) => {
    expect(BackgroundPatternSchema.safeParse({ image }).success).toBe(true);
  });

  it("accepts optional CSS layer values and controlled repeat values", () => {
    for (const repeat of [
      "repeat",
      "repeat-x",
      "repeat-y",
      "no-repeat",
      "space",
      "round",
    ]) {
      expect(
        BackgroundPatternSchema.safeParse({
          image: dotPattern,
          size: "20px 20px, 20px 20px",
          position: "0 0, 10px 10px",
          repeat,
        }).success,
      ).toBe(true);
    }
  });

  it.each([0, 1])("accepts opacity %s", (opacity) => {
    expect(
      BackgroundPatternSchema.safeParse({ image: dotPattern, opacity }).success,
    ).toBe(true);
  });

  it.each([
    ["opacity below zero", { image: dotPattern, opacity: -0.01 }],
    ["opacity above one", { image: dotPattern, opacity: 1.01 }],
    ["empty image", { image: "" }],
    ["empty size", { image: dotPattern, size: "" }],
    ["empty position", { image: dotPattern, position: "" }],
    ["uncontrolled repeat", { image: dotPattern, repeat: "repeat space" }],
  ])("rejects %s", (_name, pattern) => {
    expect(BackgroundPatternSchema.safeParse(pattern).success).toBe(false);
  });

  it.each([
    "URL (https://example.com/pattern.png)",
    "IMAGE-SET (url(pattern.png) 1x)",
    "VAR (--background-pattern)",
    "PAINT (grid)",
    "CROSS-FADE (url(a.png), url(b.png))",
    "ELEMENT (#source)",
    "@ import url(pattern.css)",
  ])("rejects external or dynamic image syntax: %s", (image) => {
    expect(BackgroundPatternSchema.safeParse({ image }).success).toBe(false);
  });

  it("strips unknown fields", () => {
    expect(
      BackgroundPatternSchema.parse({
        image: dotPattern,
        unsupported: true,
      }),
    ).toEqual({ image: dotPattern });
  });
});

describe("canonical visual schemas", () => {
  it("leaves existing visual contracts unchanged", () => {
    expect(
      GradientSchema.safeParse({
        type: "linear",
        stops: [
          { color: "#fff", position: 0 },
          { color: "#000", position: 100 },
        ],
      }).success,
    ).toBe(true);

    expect(
      BorderSchema.safeParse({
        width: 2,
        gradient: {
          type: "radial",
          stops: [
            { color: "#fff", position: 0 },
            { color: "#000", position: 100 },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it("leaves Divider, Blocks, and Scripted schemas unchanged", () => {
    expect(
      DividerElementSchema.safeParse({
        id: "divider",
        type: "divider",
        hidden: false,
      }).success,
    ).toBe(true);
    expect(
      BlocksElementSchema.safeParse({
        id: "blocks",
        type: "blocks",
        hidden: false,
        items: [],
      }).success,
    ).toBe(true);
    expect(
      ScriptedElementSchema.safeParse({
        id: "scripted",
        type: "scripted",
        hidden: false,
      }).success,
    ).toBe(true);
  });
});
