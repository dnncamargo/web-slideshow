import { describe, expect, it } from "vitest";
import { BlocksElementSchema } from "../src/elements";
import type { BlockPart } from "../src/elements";

const category = { id: "motion", name: "Motion", color: "#22c55e" };
const text = (id: string, value: string) => ({ id, type: "text" as const, text: value });
const literal = (id: string, value: string) => ({ id, type: "socket" as const, content: { type: "literal" as const, value } });
const empty = (id: string) => ({ id, type: "socket" as const, content: { type: "empty" as const } });
const value = (id: string, parts: BlockPart[] = [text(`${id}-part`, "value")]) => ({ id, categoryId: "motion", shape: "value" as const, parts, children: [] });
const base = (items: unknown[] = [{ id: "root", categoryId: "motion", shape: "statement", parts: [text("p", "move")], children: [] }], categories = [category]) => ({ id: "blocks", type: "blocks", hidden: false, categories, items });

describe("BlocksElementSchema", () => {
  it("accepts composable statements, scopes, values, empty parts and sockets", () => {
    const nested = value("nested", [text("np", "inner"), { id: "ns", type: "socket" as const, content: { type: "block" as const, block: value("deep") } }]);
    const result = BlocksElementSchema.parse(base([{ id: "scope", categoryId: "motion", shape: "scope", parts: [text("a", "repeat"), literal("n", "10"), empty("e")], children: [{ id: "child", categoryId: "motion", shape: "statement", parts: [{ id: "v", type: "socket" as const, content: { type: "block" as const, block: nested } }], children: [] }] }]));
    expect(result.items[0]?.shape).toBe("scope");
  });

  it("accepts a statement root with empty parts", () => {
    expect(BlocksElementSchema.parse(base([{ id: "s", categoryId: "motion", shape: "statement", parts: [], children: [] }])).items).toHaveLength(1);
  });

  it("accepts a scope root with statement children", () => {
    expect(BlocksElementSchema.parse(base([{ id: "scope", categoryId: "motion", shape: "scope", parts: [], children: [{ id: "child", categoryId: "motion", shape: "statement", parts: [], children: [] }] }])).items[0]?.shape).toBe("scope");
  });

  it("accepts an empty socket and empty literal", () => {
    expect(BlocksElementSchema.parse(base([{ id: "s", categoryId: "motion", shape: "statement", parts: [empty("e"), literal("l", "")], children: [] }]))).toBeTruthy();
  });

  it("accepts recursively nested value sockets", () => {
    const inner = value("inner");
    const outer = value("outer", [{ id: "socket", type: "socket", content: { type: "block", block: inner } }]);
    expect(BlocksElementSchema.parse(base([{ id: "s", categoryId: "motion", shape: "statement", parts: [{ id: "socket", type: "socket", content: { type: "block", block: outer } }], children: [] }]))).toBeTruthy();
  });

  it("rejects statement/value children and root value", () => {
    const child = { id: "x", categoryId: "motion", shape: "statement" as const, parts: [], children: [] };
    expect(() => BlocksElementSchema.parse(base([{ id: "x", categoryId: "motion", shape: "statement", parts: [], children: [child] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "x", categoryId: "motion", shape: "value", parts: [], children: [child] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "x", categoryId: "motion", shape: "value", parts: [], children: [] }]))).toThrow();
  });

  it("rejects value scope children and statement/scope sockets", () => {
    const child = { id: "x", categoryId: "motion", shape: "value" as const, parts: [], children: [] };
    expect(() => BlocksElementSchema.parse(base([{ id: "s", categoryId: "motion", shape: "scope", parts: [], children: [child] }]))).toThrow();
    for (const shape of ["statement", "scope"] as const) expect(() => BlocksElementSchema.parse(base([{ id: "s", categoryId: "motion", shape: "statement", parts: [{ id: "p", type: "socket" as const, content: { type: "block" as const, block: { id: "x", categoryId: "motion", shape, parts: [], children: [] } } }], children: [] }]))).toThrow();
  });

  it("validates category references and uniqueness on both recursion edges", () => {
    expect(() => BlocksElementSchema.parse(base([{ id: "x", categoryId: "missing", shape: "statement", parts: [], children: [] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "x", categoryId: "motion", shape: "scope", parts: [], children: [{ id: "y", categoryId: "missing", shape: "statement", parts: [], children: [] }] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "x", categoryId: "motion", shape: "statement", parts: [literal("a", ""), { id: "b", type: "socket" as const, content: { type: "block" as const, block: { ...value("v"), categoryId: "missing" } } }], children: [] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([], [category, category]))).toThrow();
  });

  it("rejects provider fields without synthesizing", () => {
    expect(() => BlocksElementSchema.parse({ id: "b", type: "blocks", hidden: false, categories: [], items: [], workspace: {}, generatedCode: "x", runtime: true })).toThrow();
  });

  it("does not synthesize canonical arrays or nodes", () => {
    const parsed = BlocksElementSchema.parse({ id: "b", type: "blocks", hidden: false, categories: [], items: [] });
    expect(parsed.categories).toEqual([]);
    expect(parsed.items).toEqual([]);
    expect(Object.hasOwn(parsed, "parts")).toBe(false);
  });

  it("rejects a missing category at each contextual location independently", () => {
    expect(() => BlocksElementSchema.parse(base([{ id: "root", categoryId: "missing", shape: "statement", parts: [], children: [] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "scope", categoryId: "motion", shape: "scope", parts: [], children: [{ id: "child", categoryId: "missing", shape: "statement", parts: [], children: [] }] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "root", categoryId: "motion", shape: "statement", parts: [{ id: "socket", type: "socket", content: { type: "block", block: { ...value("nested"), categoryId: "missing" } } }], children: [] }]))).toThrow();
  });
});
