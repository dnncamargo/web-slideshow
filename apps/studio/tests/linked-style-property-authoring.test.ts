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

  it("creates one canonical style with a generated id and exactly one authored property", () => {
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [] });
    const result = createLinkedStyleWithProperty(presentation, "  Card  ", "gap");
    expect(result.linkedStyleId).toBe("card");
    expect(result.presentation.linkedStyles).toHaveLength(1);
    expect(listLinkedStyleAuthoredProperties(result.presentation.linkedStyles?.[0]!)).toEqual(["gap"]);
  });
});
