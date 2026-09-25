import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  resolveLinkedContainerStyle,
  resolveLinkedCodeStyle,
  resolveLinkedTerminalStyle,
  resolveLinkedTableStyle,
  resolveLinkedDividerStyle,
  resolveLinkedTopicsStyle,
  type ContainerElement,
  type Presentation,
} from "../src";

const container = (overrides: Partial<ContainerElement> = {}): ContainerElement => ({
  id: "container",
  type: "container",
  hidden: false,
  children: [],
  ...overrides,
});

const presentation = (
  linkedStyles: unknown[] = [],
  palette?: unknown,
): Presentation => PresentationSchema.parse({
  schemaVersion: 1,
  id: "presentation",
  title: "Presentation",
  linkedStyles,
  ...(palette === undefined ? {} : { palette }),
  slides: [],
});

describe("resolveLinkedContainerStyle", () => {
  it("returns only local authored values when the Container has no link", () => {
    const result = resolveLinkedContainerStyle(presentation(), container({
      layout: { margin: 0 },
      style: { className: "local" },
      effect: { opacity: 0 },
    }));

    expect(result).toEqual({
      layout: { margin: 0 },
      style: { className: "local" },
      effect: { opacity: 0 },
    });
    expect(result).not.toHaveProperty("typography");
  });

  it("resolves authored Linked Style namespaces without defaults", () => {
    const result = resolveLinkedContainerStyle(presentation([{
      id: "card",
      name: "Card",
      layout: { padding: 16 },
      style: { borderRadius: 8 },
      typography: { fontSize: 20 },
      effect: { opacity: 0.5 },
    }]), container({ linkedStyleId: "card" }));

    expect(result).toEqual({
      layout: { padding: 16 },
      style: { borderRadius: 8 },
      typography: { fontSize: 20 },
      effect: { opacity: 0.5 },
    });
    expect(result.layout?.children).toBeUndefined();
  });

  it("merges direct properties while retaining unoverridden linked values", () => {
    const result = resolveLinkedContainerStyle(presentation([{
      id: "card", name: "Card",
      layout: { padding: 16, margin: 8 },
      style: { color: "#111111", borderRadius: 4 },
      typography: { fontSize: 18, fontWeight: 400 },
      effect: { opacity: 0.5 },
    }]), container({
      linkedStyleId: "card",
      layout: { padding: 24 },
      style: { color: "#222222", className: "local" },
      typography: { fontSize: 22 },
      effect: { opacity: 0 },
    }));

    expect(result).toMatchObject({
      layout: { padding: 24, margin: 8 },
      style: { color: "#222222", borderRadius: 4, className: "local" },
      typography: { fontSize: 22, fontWeight: 400 },
      effect: { opacity: 0 },
    });
  });

  it("merges Container child layout directly and replaces fit atomically", () => {
    const linkedFit = { mode: "contain" as const, sourceWidth: 100, sourceHeight: 50 };
    const localFit = { mode: "cover" as const, sourceWidth: 200, sourceHeight: 100 };
    const result = resolveLinkedContainerStyle(presentation([{
      id: "card", name: "Card",
      layout: { children: { direction: "column", gap: 12, fit: linkedFit } },
    }]), container({
      linkedStyleId: "card",
      layout: { children: { gap: 0, fit: localFit } },
    }));

    expect(result.layout?.children).toEqual({ direction: "column", gap: 0, fit: localFit });
    expect(result.layout?.children?.fit).not.toBe(linkedFit);
  });

  it("merges background members and keeps Border atomic", () => {
    const linkedBorder = { width: 1, color: "#111111" };
    const localBorder = { width: 2, color: "#222222" };
    const gradient = { type: "linear" as const, stops: [{ color: "#111111", position: 0 }, { color: "#222222", position: 100 }] };
    const pattern = {
      image: "linear-gradient(var(--presentation-pattern-color-1), transparent)",
      colors: ["#ffffff"],
      rotation: 18,
    };
    const result = resolveLinkedContainerStyle(presentation([{
      id: "card", name: "Card",
      style: { background: { color: "#111111", gradient, pattern }, border: linkedBorder },
    }]), container({
      linkedStyleId: "card",
      style: { background: { color: "#333333" }, border: localBorder },
    }));

    expect(result.style?.background).toEqual({ color: "#333333", gradient, pattern });
    expect(result.style?.border).toEqual(localBorder);
  });

  it("treats TextStroke and Shadow as atomic authored values", () => {
    const linkedStroke = { width: 1, color: "#111111" };
    const localStroke = { width: 2, color: "#222222" };
    const linkedShadow = { x: 1, y: 2, blur: 3, color: "#111111" };
    const localShadow = { x: 0, y: 0, blur: 0, color: "#222222" };
    const result = resolveLinkedContainerStyle(presentation([{
      id: "card", name: "Card",
      typography: { fontSize: 18, textStroke: linkedStroke },
      effect: { opacity: 0.5, shadow: linkedShadow },
    }]), container({
      linkedStyleId: "card",
      typography: { textStroke: localStroke },
      effect: { shadow: localShadow },
    }));

    expect(result.typography).toEqual({ fontSize: 18, textStroke: localStroke });
    expect(result.effect).toEqual({ opacity: 0.5, shadow: localShadow });
  });

  it("preserves local className and canonical palette references", () => {
    const reference = { kind: "palette" as const, colorId: "accent" };
    const result = resolveLinkedContainerStyle(presentation([{
      id: "card", name: "Card", style: { color: reference },
    }], { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] }), container({ linkedStyleId: "card", style: { className: "local" } }));

    expect(result.style).toEqual({ color: reference, className: "local" });
  });

  it("does not mutate source presentation, Container, or nested source values", () => {
    const linked = { id: "card", name: "Card", layout: { children: { gap: 12 } } };
    const source = presentation([linked]);
    const target = container({ linkedStyleId: "card", layout: { children: { direction: "column" } } });
    const snapshot = structuredClone({ source, target });

    resolveLinkedContainerStyle(source, target);

    expect({ source, target }).toEqual(snapshot);
  });

  it("fails loudly for an unresolved runtime linked style reference", () => {
    expect(() => resolveLinkedContainerStyle(presentation(), container({ linkedStyleId: "missing" }))).toThrow(
      "Unresolved linked container style: missing",
    );
  });

  it("resolves Topics values with local authored overrides without mutation", () => {
    const source = presentation([{ target: "topics", id: "topics", name: "Topics", layout: { position: "absolute", top: 10 }, rootMarkerStyle: "square", itemGap: 8 }]);
    const target = { id: "topics-element", type: "topics" as const, hidden: false, kind: "unordered" as const, items: [], linkedStyleId: "topics", layout: { position: "absolute" as const, top: 20 } };
    const snapshot = structuredClone({ source, target });
    expect(resolveLinkedTopicsStyle(source, target)).toEqual({ kind: "unordered", layout: { position: "absolute", top: 20 }, rootMarkerStyle: "square", itemGap: 8 });
    expect({ source, target }).toEqual(snapshot);
  });

  it("resolves linked kind and lets a local kind override it", () => {
    const source = presentation([{ target: "topics", id: "topics", name: "Topics", kind: "ordered" }]);
    const inherited = { id: "inherited", type: "topics" as const, hidden: false, items: [], linkedStyleId: "topics" };
    const local = { ...inherited, kind: "unordered" as const };

    expect(resolveLinkedTopicsStyle(source, inherited).kind).toBe("ordered");
    expect(resolveLinkedTopicsStyle(source, local).kind).toBe("unordered");
    expect(resolveLinkedTopicsStyle(presentation(), { id: "standalone", type: "topics", hidden: false, items: [] }).kind).toBe("unordered");
  });

  it("fails loudly for unresolved or incompatible Topics references", () => {
    const target = { id: "topics-element", type: "topics" as const, hidden: false, kind: "unordered" as const, items: [], linkedStyleId: "missing" };
    expect(() => resolveLinkedTopicsStyle(presentation(), target)).toThrow("Unresolved linked topics style: missing");
    expect(() => resolveLinkedTopicsStyle(presentation([{ id: "container", name: "Container", layout: { padding: 1 } }]), { ...target, linkedStyleId: "container" })).toThrow("not compatible");
  });
});

describe("resolveLinked target styles", () => {
  it("merges Code and Terminal namespaces without resolving canonical data", () => {
    const source = presentation([
      { target: "code", id: "code", name: "Code", layout: { width: 320 }, style: { color: "#111111", background: { color: "#222222", gradient: { type: "linear", stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 100 }] } } }, typography: { fontSize: 18 }, effect: { opacity: 0.5 } },
      { target: "terminal", id: "terminal", name: "Terminal", style: { commandColor: "#ff0000", outputColor: "#00ff00" }, typography: { fontSize: 16 }, titleTypography: { fontWeight: 700, fontSize: 12 } },
    ]);
    const code = { id: "code-element", type: "code" as const, hidden: false, linkedStyleId: "code", code: "local", language: "ts", showLineNumbers: true, highlightedLines: [], style: { background: { color: "#333333" } }, effect: { opacity: 0 } };
    const terminal = { id: "terminal-element", type: "terminal" as const, hidden: false, linkedStyleId: "terminal", lines: [], titleTypography: { fontSize: 20 } };
    expect(resolveLinkedCodeStyle(source, code)).toMatchObject({ layout: { width: 320 }, style: { color: "#111111", background: { color: "#333333", gradient: expect.any(Object) } }, typography: { fontSize: 18 }, effect: { opacity: 0 } });
    expect(resolveLinkedTerminalStyle(source, terminal)).toMatchObject({ style: { commandColor: "#ff0000", outputColor: "#00ff00" }, typography: { fontSize: 16 }, titleTypography: { fontSize: 20, fontWeight: 700 } });
    expect(code.code).toBe("local");
  });

  it("resolves both Table modes and Divider geometry while preserving local ownership", () => {
    const source = presentation([
      { target: "table", mode: "simple", id: "simple", name: "Simple", style: { color: "#fff" }, typography: { fontSize: 16 } },
      { target: "table", mode: "structured", id: "structured", name: "Structured", style: { headerBackground: "#111", bodyRowAlternateBackground: "#222", dividerOpacity: 0.2 } },
      { target: "divider", id: "divider", name: "Divider", layout: { width: 40 }, style: { background: { color: "#abc", gradient: { type: "linear", stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }] } } } },
    ]);
    const simple = { id: "simple-element", type: "table" as const, hidden: false, linkedStyleId: "simple", columns: [], rows: [] };
    const structured = { id: "structured-element", type: "table" as const, hidden: false, linkedStyleId: "structured", mode: "structured" as const, showHeader: false, columns: [], rows: [] };
    const divider = { id: "divider-element", type: "divider" as const, hidden: false, linkedStyleId: "divider", orientation: "vertical" as const, style: { background: { color: "#def" } } };
    expect(resolveLinkedTableStyle(source, simple)).toMatchObject({ style: { color: "#ffffff" }, typography: { fontSize: 16 } });
    expect(resolveLinkedTableStyle(source, structured)).toMatchObject({ style: { headerBackground: "#111111", bodyRowAlternateBackground: "#222222", dividerOpacity: 0.2 } });
    expect(resolveLinkedDividerStyle(source, divider)).toMatchObject({ layout: { width: 40 }, style: { background: { color: "#def", gradient: expect.any(Object) } } });
  });

  it("fails loudly for missing and incompatible target references without mutation", () => {
    const source = presentation([{ target: "code", id: "code", name: "Code", style: { color: "#111" } }, { target: "table", mode: "structured", id: "structured", name: "Structured", style: { dividerOpacity: 0.2 } }]);
    const code = { id: "code-element", type: "code" as const, hidden: false, linkedStyleId: "code", code: "x", language: "text", showLineNumbers: true, highlightedLines: [] };
    const snapshot = structuredClone({ source, code });
    expect(() => resolveLinkedCodeStyle(source, { ...code, linkedStyleId: "missing" })).toThrow("Unresolved linked code style: missing");
    expect(() => resolveLinkedTableStyle(source, { id: "simple", type: "table", hidden: false, linkedStyleId: "structured", columns: [], rows: [] })).toThrow("incompatible");
    resolveLinkedCodeStyle(source, code);
    expect({ source, code }).toEqual(snapshot);
  });
});
