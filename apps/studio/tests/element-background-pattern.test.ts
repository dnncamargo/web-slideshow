import { describe, expect, it } from "vitest";
import { BackgroundPatternSchema } from "@web-slideshow/document-schema";

import {
  BACKGROUND_PATTERN_PRESETS,
  applyPresetPatternColors,
  createCircuitGridImage,
  createCrossPattern,
  createCrossedAxesImage,
  createDashedPaperPattern,
  createChevronPattern,
  createGraphPaperDottedPattern,
  createPaperPattern,
  createTripleAxisOverlayImage,
  findBackgroundPatternPreset,
  getPatternSizeValue,
  materializeBackgroundPatternPreset,
  parseBackgroundPatternCss,
  renderBackgroundPatternCss,
  updateBackgroundPatternRotation,
  updateBackgroundPatternSize,
} from "../src/features/editor/inspector/sections/element-background-pattern";

describe("Container background pattern authoring primitives", () => {
  it("defines all fourteen deterministic presets without a persisted identity", () => {
    expect(BACKGROUND_PATTERN_PRESETS.map((preset) => preset.id)).toEqual([
      "grid",
      "fine-grid",
      "dots",
      "offset-dots",
      "diagonal-lines",
      "art-deco",
      "circuit-grid",
      "paper",
      "graph-paper-dotted",
      "dashed-paper",
      "cross",
      "crossed-axes",
      "triple-axis-overlay",
      "chevron",
    ]);

    expect(BACKGROUND_PATTERN_PRESETS[0]).not.toHaveProperty("preset");
    expect(BACKGROUND_PATTERN_PRESETS[0]).not.toHaveProperty("provider");
    expect(BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "diagonal-lines")?.pattern.rotation).toBe(135);
  });

  it.each(BACKGROUND_PATTERN_PRESETS)("preset $id is canonical Pattern data", (preset) => {

    expect(preset).toBeDefined();
    expect(preset?.pattern.image).toMatch(/gradient\(/);
    expect(BackgroundPatternSchema.safeParse(preset.pattern).success).toBe(true);
    expect(findBackgroundPatternPreset(preset.pattern)).toBe(preset.id);
    expect(preset.pattern.colors).toHaveLength(preset.id === "art-deco" ? 4 : ["circuit-grid", "paper", "dashed-paper", "cross", "crossed-axes"].includes(preset.id) ? 2 : preset.id === "triple-axis-overlay" ? 3 : 1);
    if (!["circuit-grid", "paper", "graph-paper-dotted", "dashed-paper", "cross", "crossed-axes", "triple-axis-overlay"].includes(preset.id)) expect(preset.pattern.image).not.toMatch(/\b\d+px\b/);
    expect(preset.pattern.repeat).toBe("repeat");
    if (!["paper", "graph-paper-dotted", "dashed-paper", "cross", "crossed-axes", "triple-axis-overlay", "chevron"].includes(preset.id)) {
      expect(preset.pattern.size).toMatch(/^\d+(?:\.\d+)?px \d+(?:\.\d+)?px$/);
    }
  });

  it("uses valid structured geometry for Art Deco", () => {
    const pattern = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "art-deco")!.pattern;
    const image = pattern.image;

    expect(image).not.toContain("radial-gradient(");
    expect(image).not.toContain("ellipse");
    expect(image).not.toContain("linear-gradient(90deg");
    expect(image).toContain("linear-gradient(45deg");
    expect(image).toContain("linear-gradient(135deg");
    expect(image).not.toContain("transparent 50% 53% 100%");
    for (const slot of [1, 2, 3, 4]) {
      expect(image).toContain(`--presentation-pattern-color-${slot}`);
    }
    expect(pattern.size).toBe("160px 111.7px");
    expect(getPatternSizeValue(pattern, "art-deco")).toBe(80);
    expect(BackgroundPatternSchema.safeParse(pattern).success).toBe(true);

    const doubled = updateBackgroundPatternSize(pattern, "art-deco", 160);
    expect(doubled).toMatchObject({
      size: "320px 223.4px",
      image,
      colors: pattern.colors,
      repeat: pattern.repeat,
    });
    expect(getPatternSizeValue(doubled, "art-deco")).toBe(160);
    expect(findBackgroundPatternPreset({ ...doubled, colors: ["#1", "#2", "#3", "#4"], rotation: 20 })).toBe("art-deco");
  });

  it("uses the supplied parametric Circuit Grid formula", () => {
    const pattern = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "circuit-grid")!.pattern;

    expect(pattern.colors).toEqual(["#444cf7", "#444cf7"]);
    expect(pattern.size).toBe("80px 80px");
    expect(pattern.image).toBe(createCircuitGridImage(20));
    expect(pattern.image).toContain("39px");
    expect(pattern.image).toContain("40px");
    expect(pattern.image).toContain("79px");
    expect(pattern.image).toContain("80px");
    expect(pattern.image).toContain("40px 40px");
    expect(pattern.image).toContain("3.2px");
    expect(pattern.image).toContain("3.7px");
    expect(pattern.image).toContain("2.4px");
    expect(pattern.image).toContain("2.9px");
    expect(pattern.image).toContain("--presentation-pattern-color-1");
    expect(pattern.image).toContain("--presentation-pattern-color-2");
    expect(BackgroundPatternSchema.safeParse(pattern).success).toBe(true);

    const size30 = updateBackgroundPatternSize(pattern, "circuit-grid", 30);
    expect(size30).toMatchObject({ size: "120px 120px", colors: pattern.colors, repeat: pattern.repeat });
    expect(size30.image).toBe(createCircuitGridImage(30));
    expect(size30.image).not.toBe(pattern.image);
    expect(size30.image).toContain("59px");
    expect(size30.image).toContain("60px");
    expect(size30.image).toContain("119px");
    expect(size30.image).toContain("120px");
    expect(size30.image).toContain("4.8px");
    expect(size30.image).toContain("5.3px");
    expect(size30.image).toContain("3.6px");
    expect(size30.image).toContain("4.1px");
    expect(findBackgroundPatternPreset({ ...size30, colors: ["#123456", "#654321"], rotation: 20 })).toBe("circuit-grid");
  });

  it("uses the supplied parametric Paper formula", () => {
    const pattern = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "paper")!.pattern;

    expect(pattern.colors).toEqual(["#444cf7", "#444cf7"]);
    expect(pattern.size).toBe("100px 100px, 100px 100px, 20px 20px, 20px 20px");
    expect(pattern.position).toBe("-2px -2px, -2px -2px, -1px -1px, -1px -1px");
    expect(pattern.image).toBe(createPaperPattern(20).image);
    expect(pattern.image).toContain("--presentation-pattern-color-1) 2px");
    expect(pattern.image).toContain("--presentation-pattern-color-2) 1px");
    expect(pattern.image).not.toContain("#E5E5F7");
    expect(BackgroundPatternSchema.safeParse(pattern).success).toBe(true);

    const size30 = updateBackgroundPatternSize(pattern, "paper", 30);
    expect(size30).toMatchObject({
      colors: pattern.colors,
      size: "150px 150px, 150px 150px, 30px 30px, 30px 30px",
      position: "-3px -3px, -3px -3px, -1.5px -1.5px, -1.5px -1.5px",
    });
    expect(size30.image).toBe(createPaperPattern(30).image);
    expect(findBackgroundPatternPreset({ ...size30, colors: ["#123456", "#654321"], rotation: 20 })).toBe("paper");
  });

  it("uses the supplied parametric Graph Paper Dotted formula", () => {
    const pattern = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "graph-paper-dotted")!.pattern;

    expect(pattern.colors).toEqual(["#444cf7"]);
    expect(pattern.size).toBe("10px 40px, 40px 10px");
    expect(pattern.position).toBe("-5px -20px, -20px -5px");
    expect(pattern.image).toBe(createGraphPaperDottedPattern(20).image);
    expect(pattern.image.match(/--presentation-pattern-color-1/g)).toHaveLength(2);
    expect(pattern.image).toContain("1.6px");
    expect(BackgroundPatternSchema.safeParse(pattern).success).toBe(true);

    const size30 = updateBackgroundPatternSize(pattern, "graph-paper-dotted", 30);
    expect(size30).toMatchObject({
      colors: pattern.colors,
      size: "15px 60px, 60px 15px",
      position: "-7.5px -30px, -30px -7.5px",
    });
    expect(size30.image).toBe(createGraphPaperDottedPattern(30).image);
    expect(size30.image).toContain("2.4px");
    expect(findBackgroundPatternPreset({ ...size30, rotation: 20 })).toBe("graph-paper-dotted");
  });

  it("uses the supplied parametric Dashed Paper and Cross formulas", () => {
    const dashed = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "dashed-paper")!.pattern;
    expect(dashed.colors).toEqual(["#444cf7", "#e5e5f7"]);
    expect(dashed.size).toBe("100% 100%, 100% 100%, 40px 40px, 40px 40px");
    expect(dashed.position).toBe("0 0, 0 0, 0 -0.4px, -0.4px 0");
    expect(dashed.image).toBe(createDashedPaperPattern(20).image);
    expect(dashed.image).toContain("3.33px");
    expect(dashed.image).toContain("10px");
    expect(dashed.image).toContain("13.33px");
    expect(dashed.image).toContain("1.2px");
    const dashed30 = updateBackgroundPatternSize(dashed, "dashed-paper", 30);
    expect(dashed30).toMatchObject({ size: "100% 100%, 100% 100%, 60px 60px, 60px 60px", position: "0 0, 0 0, 0 -0.6px, -0.6px 0", colors: dashed.colors });
    expect(dashed30.image).toContain("5px");
    expect(dashed30.image).toContain("15px");
    expect(dashed30.image).toContain("20px");
    expect(dashed30.image).toContain("1.8px");
    expect(findBackgroundPatternPreset({ ...dashed30, rotation: 20 })).toBe("dashed-paper");

    const cross = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "cross")!.pattern;
    expect(cross.colors).toEqual(["#444cf7", "#e5e5f7"]);
    expect(cross.size).toBe("100px 100px, 100px 100px, 50px 50px, 50px 50px");
    expect(cross.position).toBe("0 0, 50px 50px, 0 -2px, -2px 0");
    expect(cross.image).toBe(createCrossPattern(20).image);
    expect(cross.image).toContain("20%");
    expect(cross.image).toContain("80%");
    expect(cross.image).toContain("4px");
    const cross30 = updateBackgroundPatternSize(cross, "cross", 30);
    expect(cross30).toMatchObject({ size: "150px 150px, 150px 150px, 75px 75px, 75px 75px", position: "0 0, 75px 75px, 0 -3px, -3px 0", colors: cross.colors });
    expect(cross30.image).toContain("6px");
    expect(findBackgroundPatternPreset({ ...cross30, rotation: 20 })).toBe("cross");
  });

  it("uses the supplied Crossed Axes, Triple-Axis, and Chevron geometry", () => {
    const crossed = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "crossed-axes")!.pattern;
    expect(crossed.colors).toEqual(["#444cf7", "#22d1ee"]);
    expect(crossed.size).toBeUndefined();
    expect(crossed.image).toBe(createCrossedAxesImage(20));
    expect(crossed.image).toContain("10px");
    expect(crossed.image).toContain("30px");
    const crossed30 = updateBackgroundPatternSize(crossed, "crossed-axes", 30);
    expect(crossed30.image).toBe(createCrossedAxesImage(30));
    expect(crossed30.image).toContain("15px");
    expect(crossed30.image).toContain("45px");
    expect(findBackgroundPatternPreset({ ...crossed30, colors: ["#1", "#2"], rotation: 20 })).toBe("crossed-axes");

    const triple = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "triple-axis-overlay")!.pattern;
    expect(triple.colors).toEqual(["#444cf7", "#22d1ee", "#df53ff"]);
    expect(triple.size).toBeUndefined();
    expect(triple.image).toBe(createTripleAxisOverlayImage(20));
    expect(triple.image).toContain("45deg");
    expect(triple.image).toContain("-45deg");
    expect(triple.image).toContain("90deg");
    expect(triple.image).toContain("70px");
    expect(triple.image).toContain("80px");
    const triple30 = updateBackgroundPatternSize(triple, "triple-axis-overlay", 30);
    expect(triple30.image).toBe(createTripleAxisOverlayImage(30));
    expect(triple30.image).toContain("105px");
    expect(triple30.image).toContain("120px");
    expect(findBackgroundPatternPreset({ ...triple30, colors: ["#1", "#2", "#3"], rotation: 20 })).toBe("triple-axis-overlay");

    const chevron = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "chevron")!.pattern;
    expect(chevron.colors).toEqual(["#444cf7"]);
    expect(chevron.image).toBe(createChevronPattern(20).image);
    expect(chevron.size).toBe("40px 40px, 40px 40px, 40px 40px, 40px 40px");
    expect(chevron.position).toBe("-20px 0, -20px 0, 0 0, 0 0");
    expect(chevron.image.match(/linear-gradient\((?:135|225|315|45)deg/g)).toHaveLength(4);
    const chevron30 = updateBackgroundPatternSize(chevron, "chevron", 30);
    expect(chevron30.image).toBe(chevron.image);
    expect(chevron30.size).toBe("60px 60px, 60px 60px, 60px 60px, 60px 60px");
    expect(chevron30.position).toBe("-30px 0, -30px 0, 0 0, 0 0");
    expect(findBackgroundPatternPreset({ ...chevron30, colors: ["#123456"], rotation: 20 })).toBe("chevron");
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

  it("recognizes legacy patterns and parameterized families without persisting identity", () => {
    const legacy = [
      { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "32px 32px", repeat: "repeat" as const },
      { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "16px 16px", repeat: "repeat" as const },
      { image: "radial-gradient(circle, #94a3b8 1px, transparent 1px)", size: "24px 24px", repeat: "repeat" as const },
      { image: "radial-gradient(circle, #94a3b8 1px, transparent 1px), radial-gradient(circle, #94a3b8 1px, transparent 1px)", size: "24px 24px", position: "0 0, 12px 12px", repeat: "repeat" as const },
      { image: "repeating-linear-gradient(45deg, transparent 0, transparent 8px, #cbd5e1 8px, #cbd5e1 9px)", size: "auto", repeat: "repeat" as const },
    ];
    expect(legacy.map(findBackgroundPatternPreset)).toEqual(BACKGROUND_PATTERN_PRESETS.slice(0, 5).map((preset) => preset.id));
    expect(BACKGROUND_PATTERN_PRESETS.map((preset) => findBackgroundPatternPreset(preset.pattern))).toEqual(BACKGROUND_PATTERN_PRESETS.map((preset) => preset.id));
    expect(BACKGROUND_PATTERN_PRESETS.every((preset) => !JSON.stringify(preset.pattern).includes("presetId"))).toBe(true);
  });

  it("materializes a legacy preset only when a structured edit is requested", () => {
    const legacy = { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "32px 32px", repeat: "repeat" as const };
    expect(legacy).not.toHaveProperty("colors");
    expect(materializeBackgroundPatternPreset(legacy, "grid")).toMatchObject({
      image: expect.stringContaining("--presentation-pattern-color-1"),
      size: "32px 32px",
      colors: ["#cbd5e1"],
    });
  });

  it("keeps preset family recognition while editing size and rotation", () => {
    const grid = BACKGROUND_PATTERN_PRESETS[0]!.pattern;
    expect(findBackgroundPatternPreset(updateBackgroundPatternRotation(grid, 20))).toBe("grid");
    expect(updateBackgroundPatternRotation({ ...grid, rotation: 20 }, 0).rotation).toBeUndefined();
  });

  it("keeps Offset Dots stagger geometry inside the normalized image", () => {
    const pattern = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "offset-dots")!.pattern;
    const updated = updateBackgroundPatternSize(pattern, "offset-dots", 30);
    expect(updated).toMatchObject({ size: "30px 30px", image: pattern.image });
    expect(updated.position).toBeUndefined();
    expect(pattern.image).toContain("25% 25%");
    expect(pattern.image).toContain("75% 75%");
    expect(findBackgroundPatternPreset(updated)).toBe("offset-dots");
  });

  it("gives Diagonal Lines a deterministic numeric size while retaining legacy recognition", () => {
    const legacy = { image: "repeating-linear-gradient(45deg, transparent 0, transparent 8px, #cbd5e1 8px, #cbd5e1 9px)", size: "auto", repeat: "repeat" as const };
    expect(findBackgroundPatternPreset(legacy)).toBe("diagonal-lines");
    const materialized = materializeBackgroundPatternPreset(legacy, "diagonal-lines");
    expect(materialized).toMatchObject({ colors: ["#cbd5e1"], size: "18px 18px" });
    expect(materialized.size).not.toBe("auto");
    expect(materialized.image).toContain("90deg");
    expect(materialized.image).not.toContain("45deg");
    expect(materialized.rotation).toBe(135);
    expect(materialized.image).not.toContain("8px");

    const pattern = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "diagonal-lines")!.pattern;
    const updated = updateBackgroundPatternSize(pattern, "diagonal-lines", 25);
    expect(updated.size).toBe("25px 25px");
    expect(updated.rotation).toBe(135);
    expect(updated.image).not.toContain("45deg");
    expect(findBackgroundPatternPreset(updated)).toBe("diagonal-lines");
    expect(getPatternSizeValue(updateBackgroundPatternSize(pattern, "diagonal-lines", 18), "diagonal-lines")).toBe(18);
    expect(getPatternSizeValue(updateBackgroundPatternSize(pattern, "diagonal-lines", 36), "diagonal-lines")).toBe(36);
    expect(updateBackgroundPatternSize({ ...pattern, colors: ["#123456"], rotation: 30 }, "diagonal-lines", 36)).toMatchObject({
      colors: ["#123456"],
      rotation: 30,
      image: pattern.image,
      size: "36px 36px",
    });
    expect(findBackgroundPatternPreset({ ...updated, rotation: 0 })).toBe("diagonal-lines");
  });

  it("carries effective Pattern colors by slot when switching presets", () => {
    const grid = { ...BACKGROUND_PATTERN_PRESETS[0]!.pattern, colors: ["#123456"] };
    const dots = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "dots")!;
    expect(applyPresetPatternColors(grid, dots).colors).toEqual(["#123456"]);

    const fourColorTarget = {
      ...dots,
      pattern: { ...dots.pattern, colors: ["#a", "#b", "#c", "#d"] },
    };
    expect(applyPresetPatternColors({ ...grid, colors: ["#1", "#2"] }, fourColorTarget).colors)
      .toEqual(["#1", "#2", "#c", "#d"]);
    expect(applyPresetPatternColors({ ...grid, colors: ["#1", "#2"] }, dots).colors).toEqual(["#1"]);

    const legacyGrid = { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "32px 32px", repeat: "repeat" as const };
    expect(applyPresetPatternColors(legacyGrid, dots).colors).toEqual(["#cbd5e1"]);
  });

  it.each(BACKGROUND_PATTERN_PRESETS)("keeps $id image stable while changing Size", (preset) => {
    const updated = updateBackgroundPatternSize(preset.pattern, preset.id, getPatternSizeValue(preset.pattern, preset.id) * 2);
    if (preset.id === "circuit-grid") {
      expect(updated.image).toBe(createCircuitGridImage(40));
      expect(updated.image).not.toBe(preset.pattern.image);
    } else if (preset.id === "paper") {
      expect(updated.image).toBe(createPaperPattern(40).image);
      expect(updated.position).toBe(createPaperPattern(40).position);
    } else if (preset.id === "graph-paper-dotted") {
      expect(updated.image).toBe(createGraphPaperDottedPattern(40).image);
      expect(updated.position).toBe(createGraphPaperDottedPattern(40).position);
    } else if (preset.id === "dashed-paper") {
      expect(updated.image).toBe(createDashedPaperPattern(40).image);
      expect(updated.position).toBe(createDashedPaperPattern(40).position);
    } else if (preset.id === "cross") {
      expect(updated.image).toBe(createCrossPattern(40).image);
      expect(updated.position).toBe(createCrossPattern(40).position);
    } else if (preset.id === "crossed-axes") {
      expect(updated.image).toBe(createCrossedAxesImage(40));
      expect(updated.position).toBeUndefined();
    } else if (preset.id === "triple-axis-overlay") {
      expect(updated.image).toBe(createTripleAxisOverlayImage(40));
      expect(updated.position).toBeUndefined();
    } else {
      expect(updated.image).toBe(preset.pattern.image);
    }
    expect(updated.colors).toEqual(preset.pattern.colors);
    expect(updated.rotation).toBe(preset.pattern.rotation);
    expect(updated.repeat).toBe(preset.pattern.repeat);
    if (["crossed-axes", "triple-axis-overlay"].includes(preset.id)) {
      expect(updated.size).toBeUndefined();
    } else {
      expect(updated.size).not.toBe(preset.pattern.size);
    }
    if (!["circuit-grid", "paper", "graph-paper-dotted", "dashed-paper", "cross", "crossed-axes", "triple-axis-overlay"].includes(preset.id)) expect(preset.pattern.image).not.toMatch(/\b\d+px\b/);
    if (preset.id === "dots" || preset.id === "offset-dots") {
      expect(preset.pattern.image).toContain("circle closest-side");
    }
  });

  it.each(BACKGROUND_PATTERN_PRESETS.slice(5))("recognizes $id after color, size, and rotation changes", (preset) => {
    const colors = preset.pattern.colors!.map((_, index) => index === 0 ? "#123456" : "#654321");
    const colored = { ...preset.pattern, colors };
    const sized = updateBackgroundPatternSize(colored, preset.id, getPatternSizeValue(preset.pattern, preset.id) * 2);
    const rotated = updateBackgroundPatternRotation(sized, 20);
    expect(findBackgroundPatternPreset(colored)).toBe(preset.id);
    expect(findBackgroundPatternPreset(sized)).toBe(preset.id);
    expect(findBackgroundPatternPreset(rotated)).toBe(preset.id);
  });
});
