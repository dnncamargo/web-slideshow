import { describe, expect, it } from "vitest";
import {
  BlocksElementSchema,
  CodeElementSchema,
  SimpleTableElementSchema,
  StructuredTableElementSchema,
  TerminalElementSchema,
} from "../src/elements";

const gradient = { type: "linear" as const, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] };
const border = { width: 1, style: "solid" as const, gradient };
const visual = { background: { color: "#111", gradient }, border, borderRadius: 8, className: "custom" };
const effect = { opacity: 0.5, shadow: { x: 0, y: 4, blur: 12, spread: 2, color: "#000" } };
const layout = { width: "50%", height: 120, position: "absolute" as const, top: 1, right: "2%", bottom: 3, left: 4 };

describe("canonical data element contracts", () => {
  it.each([
    ["code", CodeElementSchema, { type: "code", code: "const x = 1", language: "ts", showLineNumbers: true, highlightedLines: [] }],
    ["terminal", TerminalElementSchema, { type: "terminal", title: "shell", lines: [{ type: "command", content: "pnpm test" }] }],
    ["simple table", SimpleTableElementSchema, { type: "table", mode: "simple", columns: [{ key: "name", label: "Name" }], rows: [{ name: "PowerShow" }] }],
  ] as const)("accepts canonical namespaces for %s", (_name, schema, element) => {
    const parsed = schema.parse({ id: "data-1", hidden: false, layout, style: visual, effect, ...element });
    expect(parsed.layout?.position).toBe("absolute");
    expect(parsed.style?.background?.gradient).toEqual(gradient);
    expect(parsed.style?.border?.gradient).toEqual(gradient);
    expect(parsed.effect?.shadow?.spread).toBe(2);
  });

  it("accepts structured root styling and canonical ContentSlot styling", () => {
    const parsed = StructuredTableElementSchema.parse({
      id: "table-1", type: "table", hidden: false, mode: "structured", layout, style: visual, effect,
      columns: [{ id: "column-1", width: "30%", header: { id: "header-1", style: { color: "#fff" }, typography: { fontSize: 16 }, children: [] } }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", style: { color: "#fff" }, typography: { fontWeight: 700 }, children: [] }] }],
    });
    expect(parsed.columns[0]?.width).toBe("30%");
    expect(parsed.columns[0]?.header.typography?.fontSize).toBe(16);
  });

  it("accepts Blocks root color and preserves graph validation", () => {
    const parsed = BlocksElementSchema.parse({ id: "blocks-1", type: "blocks", hidden: false, layout, style: { color: "#ff0000", ...visual }, effect, categories: [{ id: "cat", name: "Cat", color: "#0000ff" }], items: [{ id: "item", categoryId: "cat", shape: "statement", parts: [], children: [] }] });
    expect(parsed.style?.color).toBe("#ff0000");
  });

  it.each(["width", "height", "position", "top", "right", "bottom", "left", "opacity", "shadow"] as const)("rejects legacy aggregate style.%s", (field) => {
    const result = CodeElementSchema.safeParse({ id: "code-1", hidden: false, code: "x", style: { [field]: field === "opacity" ? 0.5 : 1 } });
    expect(result.success).toBe(false);
  });

  it("rejects unsupported typography and pattern fields", () => {
    expect(CodeElementSchema.safeParse({ id: "code-1", hidden: false, code: "x", typography: {}, style: { background: { pattern: { type: "grid", color: "#000", size: 8 } } } }).success).toBe(false);
    expect(BlocksElementSchema.safeParse({ id: "blocks-1", hidden: false, categories: [], items: [], style: { background: { pattern: { type: "grid", color: "#000", size: 8 } } } }).success).toBe(false);
  });
});
