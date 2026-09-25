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

  it.each([1, 2, 3, 4])("accepts %s controlled Pattern color slots", (count) => {
    const image = `linear-gradient(${Array.from(
      { length: count },
      (_, index) => `var(--presentation-pattern-color-${index + 1}) ${index * 25}%`,
    ).join(", ")})`;

    const result = BackgroundPatternSchema.safeParse({
      image,
      colors: Array.from({ length: count }, (_, index) => `#${index + 1}${index + 1}${index + 1}`),
    });

    expect(result.success).toBe(true);
  });

  it("accepts Palette ColorValue entries in Pattern color slots", () => {
    expect(BackgroundPatternSchema.safeParse({
      image: "linear-gradient(var(--presentation-pattern-color-1), transparent)",
      colors: [{ kind: "palette", colorId: "accent" }],
    }).success).toBe(true);
  });

  it("accepts the controlled Container Background pattern variable", () => {
    expect(BackgroundPatternSchema.safeParse({
      image: "linear-gradient(var(--presentation-pattern-background-color), transparent)",
    }).success).toBe(true);
    expect(BackgroundPatternSchema.safeParse({
      image: "linear-gradient(var(--presentation-pattern-color-1), var(--presentation-pattern-background-color))",
      colors: ["#111"],
    }).success).toBe(true);
  });

  it.each([
    {
      name: "more than four colors",
      pattern: {
        image: "linear-gradient(var(--presentation-pattern-color-1), transparent)",
        colors: ["#111", "#222", "#333", "#444", "#555"],
      },
    },
    {
      name: "missing referenced slot colors",
      pattern: {
        image: "linear-gradient(var(--presentation-pattern-color-2), transparent)",
        colors: ["#111", "#222"],
      },
    },
    {
      name: "non-contiguous slots",
      pattern: {
        image: "linear-gradient(var(--presentation-pattern-color-1), var(--presentation-pattern-color-3))",
        colors: ["#111", "#222", "#333"],
      },
    },
    {
      name: "dead colors",
      pattern: {
        image: "linear-gradient(var(--presentation-pattern-color-1), transparent)",
        colors: ["#111", "#222"],
      },
    },
    {
      name: "duplicated authored literal colors",
      pattern: {
        image: "linear-gradient(var(--presentation-pattern-color-1), #111)",
        colors: ["#111"],
      },
    },
    {
      name: "colors without slot references",
      pattern: { image: "linear-gradient(#111, #222)", colors: ["#111"] },
    },
    {
      name: "arbitrary custom property",
      pattern: { image: "linear-gradient(var(--background-pattern), transparent)" },
    },
    {
      name: "misspelled controlled background property",
      pattern: { image: "linear-gradient(var(--presentation-pattern-background), transparent)" },
    },
    {
      name: "controlled background fallback",
      pattern: { image: "linear-gradient(var(--presentation-pattern-background-color, red), transparent)" },
    },
    {
      name: "slot greater than four",
      pattern: { image: "linear-gradient(var(--presentation-pattern-color-5), transparent)" },
    },
  ])("rejects $name", ({ pattern }) => {
    expect(BackgroundPatternSchema.safeParse(pattern).success).toBe(false);
  });

  it("accepts legacy literal-color images without a colors array", () => {
    expect(BackgroundPatternSchema.safeParse({
      image: "linear-gradient(#111 1px, transparent 1px)",
    }).success).toBe(true);
  });

  it.each([-360, 0, 360])("accepts rotation %s", (rotation) => {
    expect(BackgroundPatternSchema.safeParse({ image: dotPattern, rotation }).success).toBe(true);
  });

  it.each([-360.01, 360.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects rotation %s outside finite bounds",
    (rotation) => {
      expect(BackgroundPatternSchema.safeParse({ image: dotPattern, rotation }).success).toBe(false);
    },
  );

  it.each([0, 1])("accepts opacity %s", (opacity) => {
    expect(
      BackgroundPatternSchema.safeParse({ image: dotPattern, opacity }).success,
    ).toBe(true);
  });

  it.each(["repeat-x", "repeat-y", "no-repeat"] as const)(
    "accepts %s without rotation",
    (repeat) => {
      expect(
        BackgroundPatternSchema.safeParse({ image: dotPattern, repeat }).success,
      ).toBe(true);
    },
  );

  it.each(["repeat-x", "repeat-y", "no-repeat"] as const)(
    "accepts %s with zero rotation",
    (repeat) => {
      expect(
        BackgroundPatternSchema.safeParse({ image: dotPattern, repeat, rotation: 0 }).success,
      ).toBe(true);
    },
  );

  it.each(["repeat-x", "repeat-y", "no-repeat"] as const)(
    "rejects %s with nonzero rotation",
    (repeat) => {
      const result = BackgroundPatternSchema.safeParse({ image: dotPattern, repeat, rotation: 15 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join(".") === "rotation")).toBe(true);
      }
    },
  );

  it.each([undefined, "repeat", "space", "round"] as const)(
    "accepts %s with nonzero rotation",
    (repeat) => {
      expect(
        BackgroundPatternSchema.safeParse({
          image: dotPattern,
          ...(repeat === undefined ? {} : { repeat }),
          rotation: 15,
        }).success,
      ).toBe(true);
    },
  );

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
        source: "",
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
