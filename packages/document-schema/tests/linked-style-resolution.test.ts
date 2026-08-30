import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  resolveLinkedContainerStyle,
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
    const pattern = { image: "linear-gradient(#fff, #000)" };
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
});
