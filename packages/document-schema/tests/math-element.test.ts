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
  it("accepts safe links, preserves them in round-trip, and keeps links optional", () => {
    expect(MathElementSchema.parse(valid).link).toBeUndefined();
    const link = { kind: "url", href: "https://example.com/math?a=1&b=2", target: "_blank" };
    const parsed = MathElementSchema.parse({ ...valid, link });
    expect(parsed.link).toEqual(link);
    expect(JSON.parse(JSON.stringify(parsed)).link).toEqual(link);
    expect(PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", elements: [{ ...valid, link }] }] }).schemaVersion).toBe(1);
    expect(MathElementSchema.safeParse({ ...valid, link: { kind: "url", href: "javascript:alert(1)" } }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, link: { kind: "url", href: "https://example.com", target: "_parent" } }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, link: { kind: "email", href: "mailto:a@example.com" } }).success).toBe(false);
  });
  it("enforces the 4096 character bound", () => {
    expect(MathElementSchema.safeParse({ ...valid, source: "x".repeat(MATH_SOURCE_MAX_LENGTH) }).success).toBe(true);
    expect(MathElementSchema.safeParse({ ...valid, source: "x".repeat(MATH_SOURCE_MAX_LENGTH + 1) }).success).toBe(false);
  });
  it("accepts gradient style and palette references", () => {
    expect(MathElementSchema.safeParse({ ...valid, style: { color: { kind: "palette", colorId: "accent" } } }).success).toBe(true);
    expect(MathElementSchema.safeParse({ ...valid, style: { gradient: { type: "linear", stops: [{ position: 0, color: "#000000" }, { position: 100, color: "#ffffff" }] } } }).success).toBe(true);
  });
  it("accepts shared Math effects, keeps legacy documents valid, and rejects invalid effect fields", () => {
    expect(MathElementSchema.parse(valid).effect).toBeUndefined();
    const effect = {
      opacity: 0.45,
      shadow: { x: 2, y: 4, blur: 8, spread: 1, color: "#000000", inset: false },
      glow: { blur: 12, color: "#abcdef" },
    };
    const parsed = MathElementSchema.parse({ ...valid, effect });
    expect(parsed.effect).toEqual(effect);
    expect(JSON.parse(JSON.stringify(parsed)).effect).toEqual(effect);
    expect(MathElementSchema.safeParse({ ...valid, effect: { opacity: 1.1 } }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, effect: { glow: { blur: 12, color: "#abcdef" } } }).success).toBe(true);
    expect(MathElementSchema.safeParse({ ...valid, effect: { animation: { kind: "fade" } } }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, effect: { opacity: 0.5, unauthorized: true } }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, animation: { kind: "fade" } }).success).toBe(false);
  });
  it("accepts shared weight and style typography while preserving old Math documents and schema version", () => {
    expect(MathElementSchema.parse({ ...valid, typography: { fontWeight: 700, fontStyle: "italic" } }).typography).toEqual({ fontWeight: 700, fontStyle: "italic" });
    expect(MathElementSchema.parse(valid).typography).toBeUndefined();
    expect(PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", elements: [valid] }] }).schemaVersion).toBe(1);
    expect(MathElementSchema.safeParse({ ...valid, typography: { fontFamily: "KaTeX_Main" } }).success).toBe(false);
  });
  it("accepts strict Math padding without broadening other element layouts", () => {
    expect(MathElementSchema.parse(valid).layout).toBeUndefined();
    for (const field of ["padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const) {
      expect(MathElementSchema.safeParse({ ...valid, layout: { [field]: 12 } }).success).toBe(true);
      expect(MathElementSchema.safeParse({ ...valid, layout: { [field]: "1.5rem" } }).success).toBe(true);
      expect(MathElementSchema.safeParse({ ...valid, layout: { [field]: "" } }).success).toBe(false);
      expect(MathElementSchema.safeParse({ ...valid, layout: { [field]: { invalid: true } } }).success).toBe(false);
    }
    expect(MathElementSchema.safeParse({ ...valid, layout: { paddingHorizontal: 10 } }).success).toBe(false);
    expect(PresentationElementSchema.safeParse({ id: "p1", type: "plot", source: "x", layout: { padding: 10 } }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, layout: { top: 4 } }).success).toBe(false);
    expect(MathElementSchema.safeParse({ ...valid, layout: { position: "absolute", top: 4, padding: 10 } }).success).toBe(true);
    expect(PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", elements: [valid] }] }).schemaVersion).toBe(1);
  });
});
