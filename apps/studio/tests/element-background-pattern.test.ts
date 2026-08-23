import { describe, expect, it } from "vitest";

import {
  BACKGROUND_PATTERN_PRESETS,
  findBackgroundPatternPreset,
  parseBackgroundPatternCss,
  renderBackgroundPatternCss,
} from "../src/features/editor/inspector/sections/element-background-pattern";

describe("Container background pattern authoring primitives", () => {
  it("defines all five deterministic presets without a persisted identity", () => {
    expect(BACKGROUND_PATTERN_PRESETS.map((preset) => preset.id)).toEqual([
      "grid",
      "fine-grid",
      "dots",
      "offset-dots",
      "diagonal-lines",
    ]);

    expect(BACKGROUND_PATTERN_PRESETS[0]).not.toHaveProperty("preset");
    expect(BACKGROUND_PATTERN_PRESETS[0]).not.toHaveProperty("provider");
  });

  it.each([0, 1, 2, 3, 4])("preset %s is canonical Pattern data", (index) => {
    const preset = BACKGROUND_PATTERN_PRESETS[index];

    expect(preset).toBeDefined();
    expect(preset?.pattern.image).toMatch(/gradient\(/);
    expect(findBackgroundPatternPreset(preset!.pattern)).toBe(preset?.id);
  });

  it("parses MagicPattern Grid CSS", () => {
    const result = parseBackgroundPatternCss(
      "background-color: #0f172a; background-image: linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px); background-size: 20px 20px;",
    );

    expect(result).toEqual({
      success: true,
      background: "#0f172a",
      backgroundPattern: {
        image:
          "linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)",
        size: "20px 20px",
      },
    });
  });

  it("parses MagicPattern Dots CSS", () => {
    const result = parseBackgroundPatternCss(
      "background-image: radial-gradient(circle, #94a3b8 1px, transparent 1px); background-size: 24px 24px; background-repeat: repeat;",
    );

    expect(result).toMatchObject({
      success: true,
      backgroundPattern: {
        image: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
        size: "24px 24px",
        repeat: "repeat",
      },
    });
  });

  it("accepts multiline declarations and an optional trailing semicolon", () => {
    const result = parseBackgroundPatternCss(`
      background-repeat: round;
      background-image:
        radial-gradient(circle at 10% 20%, #fff 0 2px, transparent 3px),
        linear-gradient(45deg, #000 1px, transparent 1px);
      background-position: 10% 20%;
      opacity: 0.4
    `);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.backgroundPattern.image).toContain("radial-gradient");
      expect(result.backgroundPattern.repeat).toBe("round");
      expect(result.backgroundPattern.opacity).toBe(0.4);
    }
  });

  it("maps background-color to the base background", () => {
    const result = parseBackgroundPatternCss(
      "background-color: rgba(15, 23, 42, 0.5); background-image: linear-gradient(#000, #fff);",
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.background).toBe("rgba(15, 23, 42, 0.5)");
    }
  });

  it("maps opacity only to the Pattern layer", () => {
    const result = parseBackgroundPatternCss(
      "background-image: linear-gradient(#000, #fff); opacity: 0.25;",
    );

    expect(result).toMatchObject({
      success: true,
      backgroundPattern: { opacity: 0.25 },
    });
    expect(result.success && result.background).toBeUndefined();
  });

  it("parses size, position, and every canonical repeat value", () => {
    for (const repeat of ["repeat", "repeat-x", "repeat-y", "no-repeat", "space", "round"] as const) {
      const result = parseBackgroundPatternCss(
        `background-image: linear-gradient(#000, #fff); background-size: 10px 20px; background-position: center top; background-repeat: ${repeat};`,
      );

      expect(result).toMatchObject({
        success: true,
        backgroundPattern: {
          size: "10px 20px",
          position: "center top",
          repeat,
        },
      });
    }
  });

  it.each([
    "filter: blur(2px);",
    "transform: rotate(2deg);",
    "animation: spin 1s;",
    "position: absolute;",
    "display: grid;",
    "content: '';",
    "background: #000;",
    "background-url: foo;",
    "@import url(foo);",
  ])("rejects unsupported property %s", (declaration) => {
    const result = parseBackgroundPatternCss(
      `${declaration} background-image: linear-gradient(#000, #fff);`,
    );

    expect(result.success).toBe(false);
  });

  it("rejects duplicate declarations", () => {
    const result = parseBackgroundPatternCss(
      "background-image: linear-gradient(#000, #fff); background-image: linear-gradient(#fff, #000);",
    );

    expect(result.success).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("Duplicate") });
  });

  it("rejects malformed declarations", () => {
    expect(parseBackgroundPatternCss("background-image").success).toBe(false);
    expect(parseBackgroundPatternCss("background-image:;").success).toBe(false);
    expect(parseBackgroundPatternCss("background-image: linear-gradient(#000, #fff").success).toBe(false);
  });

  it("requires background-image", () => {
    expect(parseBackgroundPatternCss("background-size: 20px;").success).toBe(false);
  });

  it.each([
    "background-image: url(https://example.com/pattern.png);",
    "background-image: var(--pattern);",
  ])("rejects unsafe image syntax through canonical validation", (css) => {
    expect(parseBackgroundPatternCss(css).success).toBe(false);
  });

  it("rejects opacity outside the canonical range", () => {
    expect(
      parseBackgroundPatternCss(
        "background-image: linear-gradient(#000, #fff); opacity: 2;",
      ).success,
    ).toBe(false);
  });

  it("rejects empty values", () => {
    expect(parseBackgroundPatternCss("background-image: ;").success).toBe(false);
  });

  it("renders existing custom canonical data deterministically for hydration", () => {
    expect(
      renderBackgroundPatternCss({
        background: "#0f172a",
        backgroundPattern: {
          image: "linear-gradient(#000, #fff)",
          size: "12px 14px",
          position: "center top",
          repeat: "no-repeat",
          opacity: 0.5,
        },
      }),
    ).toBe(
      "background-color: #0f172a;\n" +
        "background-image: linear-gradient(#000, #fff);\n" +
        "background-size: 12px 14px;\n" +
        "background-position: center top;\n" +
        "background-repeat: no-repeat;\n" +
        "opacity: 0.5;",
    );
  });
});
