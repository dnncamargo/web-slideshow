import { describe, expect, it } from "vitest";
import {
  BlocksElementSchema,
  CodeElementSchema,
  SimpleTableElementSchema,
  StructuredTableElementSchema,
  TerminalElementSchema,
} from "../src/elements";
import { PresentationSchema } from "../src/presentation";

const gradient = { type: "linear" as const, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] };
const border = { width: 1, style: "solid" as const, gradient };
const visual = { background: { color: "#111", gradient }, border, borderRadius: 8, className: "custom" };
const effect = { opacity: 0.5, shadow: { x: 0, y: 4, blur: 12, spread: 2, color: "#000" } };
const layout = { width: "50%", height: 120, position: "absolute" as const, top: 1, right: "2%", bottom: 3, left: 4 };

describe("canonical data element contracts", () => {
  it("accepts shared TextContent for Terminal, Code, and Simple Table", () => {
    const richText = { type: "rich-text" as const, runs: [{ text: "marked", marks: { bold: true } }] };

    expect(TerminalElementSchema.parse({ id: "terminal-1", type: "terminal", hidden: false, title: richText, lines: [{ type: "command", content: richText }] }).title).toEqual(richText);
    expect(CodeElementSchema.parse({ id: "code-1", type: "code", hidden: false, code: richText }).code).toEqual(richText);
    expect(SimpleTableElementSchema.parse({ id: "table-1", type: "table", hidden: false, columns: [{ key: "name", label: richText }], rows: [{ name: richText, count: 1, enabled: true, empty: null }] })).toMatchObject({ columns: [{ label: richText }], rows: [{ name: richText, count: 1, enabled: true, empty: null }] });
  });
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

  it("accepts Blocks source and direct palette fields", () => {
    const parsed = BlocksElementSchema.parse({ id: "blocks-1", type: "blocks", hidden: false, layout, style: { statementColor: "#ff0000", scopeColor: "#00ff00", logicColor: "#0000ff" }, effect, source: "move [10] steps" });
    expect(parsed.source).toBe("move [10] steps");
    expect(parsed.style?.logicColor).toBe("#0000ff");
  });

  it("accepts the scoped Code typography and color contract", () => {
    const parsed = CodeElementSchema.parse({
      id: "code-1",
      type: "code",
      hidden: false,
      code: "const x = 1",
      typography: {
        fontFamily: "monospace",
        fontSize: 16,
        lineHeight: 1.5,
        letterSpacing: 0.25,
      },
      style: { color: "#ffffff" },
    });

    expect(parsed.typography?.fontFamily).toBe("monospace");
    expect(parsed.style?.color).toBe("#ffffff");
  });

  it.each([
    ["fontWeight", 700],
    ["textAlign", "center"],
    ["whiteSpace", "pre-wrap"],
  ] as const)("rejects Code typography.%s", (field, value) => {
    expect(
      CodeElementSchema.safeParse({
        id: "code-1",
        type: "code",
        hidden: false,
        code: "x",
        typography: { [field]: value },
      }).success,
    ).toBe(false);
  });

  it("rejects Code style.textColor", () => {
    expect(
      CodeElementSchema.safeParse({
        id: "code-1",
        hidden: false,
        code: "x",
        style: { textColor: "#ffffff" },
      }).success,
    ).toBe(false);
  });

  it("accepts the scoped Terminal typography and semantic colors", () => {
    const parsed = TerminalElementSchema.parse({
      id: "terminal-1",
      type: "terminal",
      hidden: false,
      lines: [{ type: "command", content: "pnpm test" }],
      typography: {
        fontFamily: "monospace",
        fontSize: 14,
        lineHeight: 1.4,
        letterSpacing: 0.1,
      },
      style: {
        commandColor: "#ffffff",
        promptColor: "#00ff00",
        outputColor: "#cccccc",
        commentColor: "#888888",
        errorColor: "#ff0000",
      },
    });

    expect(parsed.typography?.letterSpacing).toBe(0.1);
    expect(parsed.style?.promptColor).toBe("#00ff00");
  });

  it("accepts Terminal title styling while preserving schema version 1", () => {
    const parsed = TerminalElementSchema.parse({
      id: "terminal-title-1",
      type: "terminal",
      hidden: false,
      title: "shell",
      titleStyle: { color: { kind: "palette", colorId: "accent" }, borderRadius: 8, className: "title" },
      titleTypography: {
        fontFamily: "Fira Code",
        fontSize: 14,
        fontWeight: 600,
        fontStyle: "italic",
        lineHeight: 1.2,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      },
      typography: { fontFamily: "monospace", fontSize: 16, lineHeight: 1.5, letterSpacing: 0.1 },
      lines: [],
    });

    expect(parsed.title).toBe("shell");
    expect(parsed.titleStyle?.borderRadius).toBe(8);
    expect(parsed.titleTypography?.textTransform).toBe("uppercase");
    expect(parsed.typography?.fontSize).toBe(16);

    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "presentation-1",
      title: "Terminal presentation",
      slides: [{ id: "slide-1", title: "", summary: "", speakerNotes: "", elements: [parsed] }],
    });

    expect(presentation.schemaVersion).toBe(1);
  });

  it.each(["textAlign", "whiteSpace", "textStroke"] as const)(
    "rejects out-of-scope Terminal titleTypography.%s",
    (field) => {
      expect(
        TerminalElementSchema.safeParse({
          id: "terminal-title-1",
          type: "terminal",
          hidden: false,
          lines: [],
          titleTypography: { [field]: field === "textStroke" ? {} : "center" },
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    { typography: { fontWeight: 700 } },
    { typography: { textAlign: "center" } },
    { typography: { whiteSpace: "pre-wrap" } },
    { style: { color: "#ffffff" } },
    { style: { titleColor: "#ffffff" } },
    { style: { controlDotColor: "#ffffff" } },
    { unknown: true },
  ])("rejects unsupported Terminal fields %j", (extra) => {
    expect(
      TerminalElementSchema.safeParse({
        id: "terminal-1",
        type: "terminal",
        hidden: false,
        lines: [],
        ...extra,
      }).success,
    ).toBe(false);
  });

  it("accepts the scoped Simple Table typography and color contract", () => {
    const parsed = SimpleTableElementSchema.parse({
      id: "table-1",
      type: "table",
      hidden: false,
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "PowerShow" }],
      typography: { fontFamily: "sans-serif", fontSize: 16, lineHeight: 1.5 },
      style: { color: "#ffffff" },
    });

    expect(parsed.typography?.lineHeight).toBe(1.5);
    expect(parsed.style?.color).toBe("#ffffff");
  });

  it.each([
    { typography: { letterSpacing: 0.1 } },
    { typography: { fontWeight: 700 } },
    { typography: { textAlign: "center" } },
    { typography: { whiteSpace: "pre-wrap" } },
    { style: { textColor: "#ffffff" } },
    { unknown: true },
  ])("rejects unsupported Simple Table fields %j", (extra) => {
    expect(
      SimpleTableElementSchema.safeParse({
        id: "table-1",
        type: "table",
        hidden: false,
        columns: [{ key: "name", label: "Name" }],
        rows: [],
        ...extra,
      }).success,
    ).toBe(false);
  });

  it("keeps Structured Table root styling frozen", () => {
    const base = {
      id: "table-1",
      type: "table",
      hidden: false,
      mode: "structured" as const,
      columns: [{ id: "column-1", header: { id: "header-1", children: [] } }],
      rows: [{ id: "row-1", cells: [{ id: "cell-1", children: [] }] }],
    };

    expect(StructuredTableElementSchema.safeParse(base).success).toBe(true);
    expect(
      StructuredTableElementSchema.safeParse({ ...base, typography: { fontSize: 16 } }).success,
    ).toBe(false);
    expect(
      StructuredTableElementSchema.safeParse({ ...base, style: { color: "#ffffff" } }).success,
    ).toBe(false);
    expect(
      StructuredTableElementSchema.safeParse({
        ...base,
        columns: [{ id: "column-1", header: { id: "header-1", children: [], style: { color: "#ffffff" }, typography: { fontSize: 16 } } }],
      }).success,
    ).toBe(true);
  });

  it.each(["width", "height", "position", "top", "right", "bottom", "left", "opacity", "shadow"] as const)("rejects legacy aggregate style.%s", (field) => {
    const result = CodeElementSchema.safeParse({ id: "code-1", hidden: false, code: "x", style: { [field]: field === "opacity" ? 0.5 : 1 } });
    expect(result.success).toBe(false);
  });

  it("rejects unsupported typography and pattern fields", () => {
    expect(CodeElementSchema.safeParse({ id: "code-1", hidden: false, code: "x", typography: {}, style: { background: { pattern: { type: "grid", color: "#000", size: 8 } } } }).success).toBe(false);
    expect(BlocksElementSchema.safeParse({ id: "blocks-1", hidden: false, source: "", style: { background: { pattern: { type: "grid", color: "#000", size: 8 } } } }).success).toBe(false);
  });
});
