import { describe, expect, it } from "vitest";
import { BlocksElementSchema } from "../src/elements";

const base = (overrides: Record<string, unknown> = {}) => ({
  id: "blocks", type: "blocks", hidden: false, source: "", ...overrides,
});

describe("BlocksElementSchema", () => {
  it("accepts a minimal source-only Blocks element", () => {
    expect(BlocksElementSchema.parse(base())).toEqual(base());
  });

  it("stores arbitrary source opaquely without interpreting grammar", () => {
    const source = String.raw`\\scope(Repita [10] vezes)
  \\statement move [10] steps`;
    expect(BlocksElementSchema.parse(base({ source })).source).toBe(source);
  });

  it("preserves supported layout, style, and effect fields", () => {
    const parsed = BlocksElementSchema.parse(base({
      layout: { position: "absolute", left: 10, top: 20, width: 300, height: 120 },
      style: { statementColor: "#123456", scopeColor: "#234567", logicColor: "#345678" },
      effect: { opacity: 0.8, shadow: { x: 0, y: 1, blur: 2, color: "#000000" } },
    }));
    expect(parsed.style?.statementColor).toBe("#123456");
    expect(parsed.layout?.left).toBe(10);
    expect(parsed.effect?.opacity).toBe(0.8);
  });

  it("accepts strict Blocks appearance controls", () => {
    const parsed = BlocksElementSchema.parse(base({
      style: {
        categoryColors: { events: "#FFBF00", output: { kind: "palette", colorId: "accent" } },
        textColor: "#FFFFFF",
        blockBorder: { width: 2, style: "solid", color: "#111827" },
      },
    }));
    expect(parsed.style?.categoryColors?.events).toBe("#ffbf00");
    expect(parsed.style?.categoryColors?.output).toEqual({ kind: "palette", colorId: "accent" });
    expect(parsed.style?.textColor).toBe("#ffffff");
    expect(parsed.style?.blockBorder?.width).toBe(2);
    expect(() => BlocksElementSchema.parse(base({ style: { categoryColors: { unknown: "#fff" } } }))).toThrow();
    expect(() => BlocksElementSchema.parse(base({ style: { categoryColors: { motion: "#fff" } } }))).toThrow();
  });

  it.each(["items", "categories", "categoryId", "workspace", "unknown"])(
    "rejects removed or unknown field %s",
    (field) => expect(() => BlocksElementSchema.parse(base({ [field]: [] }))).toThrow(),
  );
});
