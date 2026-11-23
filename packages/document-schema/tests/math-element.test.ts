import { describe, expect, it } from "vitest";
import { MathElementSchema, MATH_SOURCE_MAX_LENGTH, PresentationElementSchema, PresentationSchema } from "../src";

const valid = { id: "m1", type: "math", format: "latex", source: String.raw`\frac{x^2}{\sqrt{y}}` };

describe("MathElementSchema", () => {
  it("accepts strict LaTeX and preserves source in JSON round-trip", () => {
    const parsed = MathElementSchema.parse(valid);
    expect(parsed.format).toBe("latex");
    expect(JSON.parse(JSON.stringify(parsed)).source).toBe(valid.source);
    expect(PresentationElementSchema.parse(valid).type).toBe("math");
  });
  it("rejects unknown keys and unsupported formats", () => {
    expect(MathElementSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, format: "mathml" }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, typography: { fontFamily: "Comic Sans" } }).success).toBe(false);
  });
  it("enforces the 4096 character bound", () => {
    expect(MathElementSchema.safeParse({ ...valid, source: "x".repeat(MATH_SOURCE_MAX_LENGTH) }).success).toBe(true);
    expect(MathElementSchema.safeParse({ ...valid, source: "x".repeat(MATH_SOURCE_MAX_LENGTH + 1) }).success).toBe(false);
  });
  it("accepts gradient style and palette references", () => {
    expect(MathElementSchema.safeParse({ ...valid, style: { color: { kind: "palette", colorId: "accent" } } }).success).toBe(true);
    expect(MathElementSchema.safeParse({ ...valid, style: { gradient: { type: "linear", stops: [{ position: 0, color: "#000000" }, { position: 100, color: "#ffffff" }] } } }).success).toBe(true);
  });
  it("accepts shared weight and style typography while preserving old Math documents and schema version", () => {
    expect(MathElementSchema.parse({ ...valid, typography: { fontWeight: 700, fontStyle: "italic" } }).typography).toEqual({ fontWeight: 700, fontStyle: "italic" });
    expect(MathElementSchema.parse(valid).typography).toBeUndefined();
    expect(PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", elements: [valid] }] }).schemaVersion).toBe(1);
    expect(MathElementSchema.safeParse({ ...valid, typography: { fontFamily: "KaTeX_Main" } }).success).toBe(false);
  });
});
