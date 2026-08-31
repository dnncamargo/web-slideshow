import { describe, expect, it } from "vitest";
import { LinkedContainerStyleSchema, PresentationSchema } from "@powershow/document-schema";
import {
  addLinkedStyleProperty,
  createLinkedStyleWithProperty,
  hasLinkedStyleProperty,
  listAvailableLinkedStyleProperties,
  listLinkedStyleAuthoredProperties,
  removeLinkedStyleProperty,
} from "../src/features/editor/linked-style-property-authoring";
import { canUpdateLinkedStyle } from "../src/features/editor/linked-style-authoring";

describe("linked style property authoring", () => {
  it("lists authored properties in deterministic semantic order and excludes typography", () => {
    const style = LinkedContainerStyleSchema.parse({ id: "x", name: "X", layout: { padding: 0, children: { gap: 0 } }, style: { background: { pattern: { image: "linear-gradient(#64748b 1px, transparent 1px)" } } }, effect: { opacity: 0 } });
    expect(listLinkedStyleAuthoredProperties(style)).toEqual(["gap", "padding", "pattern", "opacity"]);
  });

  it("adds and removes nested properties without losing siblings", () => {
    const style = LinkedContainerStyleSchema.parse({ id: "x", name: "X", layout: { children: { gap: 8 } } });
    const withPadding = addLinkedStyleProperty(style, "paddingTop");
    expect(withPadding.layout?.children?.gap).toBe(8);
    expect(withPadding.layout?.paddingTop).toBe(0);
    const withoutPadding = removeLinkedStyleProperty(withPadding, "paddingTop");
    expect(withoutPadding.layout?.children?.gap).toBe(8);
    expect(hasLinkedStyleProperty(withoutPadding, "paddingTop")).toBe(false);
  });

  it("keeps atomic values authored when they are zero or false-like", () => {
    const style = LinkedContainerStyleSchema.parse({ id: "x", name: "X", layout: { position: "absolute", top: 0, flexShrink: 0 }, effect: { opacity: 0 } });
    expect(hasLinkedStyleProperty(style, "top")).toBe(true);
    expect(hasLinkedStyleProperty(style, "preserveSize")).toBe(true);
    expect(hasLinkedStyleProperty(style, "opacity")).toBe(true);
    expect(listAvailableLinkedStyleProperties(style)).not.toContain("top");
  });

  it("only exposes position edges after absolute position and never offers fit in the add chooser", () => {
    const style = LinkedContainerStyleSchema.parse({ id: "x", name: "X", layout: { padding: 1 } });
    expect(listAvailableLinkedStyleProperties(style)).not.toContain("top");
    expect(listAvailableLinkedStyleProperties(addLinkedStyleProperty(style, "position"))).toContain("top");
    expect(listAvailableLinkedStyleProperties(style)).not.toContain("fit");
  });

  it("blocks position removal while authored edges remain", () => {
    const style = LinkedContainerStyleSchema.parse({ id: "x", name: "X", layout: { position: "absolute", top: 10 } });
    expect(removeLinkedStyleProperty(style, "position")).toBe(style);
  });

  it("keeps background siblings while removing one authored property", () => {
    const style = LinkedContainerStyleSchema.parse({ id: "x", name: "X", style: { background: { color: "#000", pattern: { image: "linear-gradient(#000, #fff)" } } } });
    const next = removeLinkedStyleProperty(style, "pattern");
    expect(next.style?.background?.color).toBe("#000000");
    expect(next.style?.background?.pattern).toBeUndefined();
  });

  it("keeps atomic visual and effect properties authored and uses shared defaults", () => {
    const style = LinkedContainerStyleSchema.parse({ id: "x", name: "X", layout: { children: { gap: 0 } } });
    const next = ["gradient", "pattern", "border", "shadow"].reduce((current, property) => addLinkedStyleProperty(current, property as "gradient" | "pattern" | "border" | "shadow"), style);
    expect(next.style?.background?.gradient).toBeDefined();
    expect(next.style?.background?.pattern).toBeDefined();
    expect(next.style?.border).toMatchObject({ width: 1, style: "solid" });
    expect(next.effect?.shadow).toMatchObject({ x: 0, y: 4, blur: 12 });
  });

  it("keeps packed distribution explicitly authored", () => {
    const style = addLinkedStyleProperty(LinkedContainerStyleSchema.parse({ id: "x", name: "X", layout: { children: { gap: 0 } } }), "distribution");
    expect(style.layout?.children?.distribution).toBe("packed");
    expect(listLinkedStyleAuthoredProperties(style)).toContain("distribution");
    expect(canUpdateLinkedStyle(PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [], linkedStyles: [style] }), "x", { layout: { children: { ...style.layout?.children, distribution: "space-between" } } })).toBe(true);
  });

  it("uses the canonical boundary to reject removal of the last authored property", () => {
    const style = LinkedContainerStyleSchema.parse({ id: "x", name: "X", layout: { children: { gap: 8 } } });
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [], linkedStyles: [style] });
    expect(canUpdateLinkedStyle(presentation, "x", { layout: undefined })).toBe(false);
    expect(canUpdateLinkedStyle(PresentationSchema.parse({ ...presentation, linkedStyles: [{ ...style, typography: { fontSize: 12 } }] }), "x", { layout: undefined })).toBe(true);
  });

  it("does not create an empty style from a blank name and creates exactly one property", () => {
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [] });
    expect(createLinkedStyleWithProperty(presentation, "   ", "gap").presentation.linkedStyles).toBeUndefined();
    const result = createLinkedStyleWithProperty(presentation, "Card", "padding");
    expect(listLinkedStyleAuthoredProperties(result.presentation.linkedStyles?.[0]!)).toEqual(["padding"]);
  });

  it("creates one canonical style with a generated id and exactly one authored property", () => {
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [] });
    const result = createLinkedStyleWithProperty(presentation, "  Card  ", "gap");
    expect(result.linkedStyleId).toBe("card");
    expect(result.presentation.linkedStyles).toHaveLength(1);
    expect(listLinkedStyleAuthoredProperties(result.presentation.linkedStyles?.[0]!)).toEqual(["gap"]);
  });
});
