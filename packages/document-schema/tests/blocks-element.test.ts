import { describe, expect, it } from "vitest";
import { BlocksElementSchema } from "../src/elements";
import type { BlockPart } from "../src/elements";

const text = (id: string, value: string) => ({ id, type: "text" as const, text: value });
const literal = (id: string, value: string) => ({ id, type: "socket" as const, content: { type: "literal" as const, value } });
const empty = (id: string) => ({ id, type: "socket" as const, content: { type: "empty" as const } });
const value = (id: string, parts: BlockPart[] = [text(`${id}-part`, "value")]) => ({ id, color: "#22c55e", shape: "value" as const, parts, children: [] });
const block = (id: string, shape: "start" | "statement" | "scope" | "value" | "logic" | "end", parts: BlockPart[] = []) => ({ id, color: "#22c55e", shape, parts, children: [] });
const base = (items: unknown[] = [{ id: "root", color: "#22c55e", shape: "statement", parts: [text("p", "move")], children: [] }]) => ({ id: "blocks", type: "blocks", hidden: false, items });

describe("BlocksElementSchema", () => {
  it("accepts composable statements, scopes, values, empty parts and sockets", () => {
    const nested = value("nested", [text("np", "inner"), { id: "ns", type: "socket" as const, content: { type: "block" as const, block: value("deep") } }]);
    const result = BlocksElementSchema.parse(base([{ id: "scope", color: "#ef4444", shape: "scope", parts: [text("a", "repeat"), literal("n", "10"), empty("e")], children: [{ id: "child", color: "#22c55e", shape: "statement", parts: [{ id: "v", type: "socket" as const, content: { type: "block" as const, block: nested } }], children: [] }] }]));
    expect(result.items[0]?.shape).toBe("scope");
  });

  it("accepts a statement root with empty parts", () => {
    expect(BlocksElementSchema.parse(base([{ id: "s", color: "#22c55e", shape: "statement", parts: [], children: [] }])).items).toHaveLength(1);
  });

  it("accepts every B3 shape in its valid family", () => {
    for (const shape of ["start", "statement", "scope", "end"] as const) {
      expect(BlocksElementSchema.parse(base([block(shape, shape)])).items[0]?.shape).toBe(shape);
    }
    for (const shape of ["value", "logic"] as const) {
      const nested = block(shape, shape);
      expect(BlocksElementSchema.parse(base([block("owner", "statement", [{ id: "socket", type: "socket", content: { type: "block", block: nested } }])]))).toBeTruthy();
    }
  });

  it("rejects reporter roots/scope children, stack socket blocks, and childless-shape children", () => {
    for (const shape of ["value", "logic"] as const) {
      expect(() => BlocksElementSchema.parse(base([block("root", shape)]))).toThrow();
      expect(() => BlocksElementSchema.parse(base([{ ...block("scope", "scope"), children: [block("child", shape)] }]))).toThrow();
    }
    for (const shape of ["start", "statement", "scope", "end"] as const) {
      const nested = block(shape, shape);
      expect(() => BlocksElementSchema.parse(base([block("owner", "statement", [{ id: "socket", type: "socket", content: { type: "block", block: nested } }])]))).toThrow();
      if (shape !== "scope") expect(() => BlocksElementSchema.parse(base([{ ...block(shape, shape), children: [block("child", "statement")] }]))).toThrow();
    }
  });

  it("accepts a scope root with statement children", () => {
    expect(BlocksElementSchema.parse(base([{ id: "scope", color: "#ef4444", shape: "scope", parts: [], children: [{ id: "child", color: "#22c55e", shape: "statement", parts: [], children: [] }] }])).items[0]?.shape).toBe("scope");
  });

  it("accepts an empty socket and empty literal", () => {
    expect(BlocksElementSchema.parse(base([{ id: "s", color: "#22c55e", shape: "statement", parts: [empty("e"), literal("l", "")], children: [] }]))).toBeTruthy();
  });

  it("accepts recursively nested value sockets", () => {
    const inner = value("inner");
    const outer = value("outer", [{ id: "socket", type: "socket", content: { type: "block", block: inner } }]);
    expect(BlocksElementSchema.parse(base([{ id: "s", color: "#22c55e", shape: "statement", parts: [{ id: "socket", type: "socket", content: { type: "block", block: outer } }], children: [] }]))).toBeTruthy();
  });

  it("rejects statement/value children and root value", () => {
    const child = { id: "x", color: "#22c55e", shape: "statement" as const, parts: [], children: [] };
    expect(() => BlocksElementSchema.parse(base([{ id: "x", color: "#22c55e", shape: "statement", parts: [], children: [child] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "x", color: "#22c55e", shape: "value", parts: [], children: [child] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "x", color: "#22c55e", shape: "value", parts: [], children: [] }]))).toThrow();
  });

  it("rejects value scope children and statement/scope sockets", () => {
    const child = { id: "x", color: "#22c55e", shape: "value" as const, parts: [], children: [] };
    expect(() => BlocksElementSchema.parse(base([{ id: "s", color: "#22c55e", shape: "scope", parts: [], children: [child] }]))).toThrow();
    for (const shape of ["statement", "scope"] as const) expect(() => BlocksElementSchema.parse(base([{ id: "s", color: "#22c55e", shape: "statement", parts: [{ id: "p", type: "socket" as const, content: { type: "block" as const, block: { id: "x", color: "#22c55e", shape, parts: [], children: [] } } }], children: [] }]))).toThrow();
  });

  it("requires a direct color on every recursion edge", () => {
    expect(() => BlocksElementSchema.parse(base([{ id: "root", shape: "statement", parts: [], children: [] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "scope", color: "#ef4444", shape: "scope", parts: [], children: [{ id: "child", shape: "statement", parts: [], children: [] }] }]))).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "root", color: "#22c55e", shape: "statement", parts: [{ id: "socket", type: "socket", content: { type: "block", block: { id: "nested", shape: "value", parts: [], children: [] } } }], children: [] }]))).toThrow();
  });

  it("rejects provider fields without synthesizing", () => {
    expect(() => BlocksElementSchema.parse({ id: "b", type: "blocks", hidden: false, items: [], workspace: {}, generatedCode: "x", runtime: true })).toThrow();
  });

  it("does not synthesize canonical arrays or nodes", () => {
    const parsed = BlocksElementSchema.parse({ id: "b", type: "blocks", hidden: false, items: [] });
    expect(parsed.items).toEqual([]);
    expect(Object.hasOwn(parsed, "parts")).toBe(false);
  });

  it("rejects removed category fields instead of accepting a legacy shape", () => {
    expect(() => BlocksElementSchema.parse({ ...base(), categories: [] })).toThrow();
    expect(() => BlocksElementSchema.parse(base([{ id: "root", categoryId: "motion", color: "#22c55e", shape: "statement", parts: [], children: [] }]))).toThrow();
  });
});
