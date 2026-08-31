import { describe, expect, it } from "vitest";

import { PresentationSchema, resolveLinkedContainerStyle, type Presentation } from "@powershow/document-schema";

import {
  attachLinkedStyle,
  canCreateLinkedStyleFromContainer,
  createLinkedStyleFromContainer,
  detachLinkedStyle,
} from "../src/features/editor/linked-style-authoring";
import { findElementById } from "../src/features/editor/element-tree";

function presentation(element: object, linkedStyles?: readonly object[]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    palette: { colors: [{ id: "brand", name: "Brand", value: "#112233" }, { id: "accent", name: "Accent", value: "#445566" }] },
    ...(linkedStyles === undefined ? {} : { linkedStyles }),
    slides: [{ id: "slide", title: "", elements: [element] }],
  });
}

function selected(result: Presentation) {
  const element = result.slides[0]!.elements[0];
  if (element?.type !== "container") throw new Error("Expected a container.");
  return element;
}

describe("linked container style authoring", () => {
  it("creates and transfers authored values without className, defaults, or structure", () => {
    const initial = presentation({
      id: "container", type: "container", hidden: true, role: "column", link: { kind: "url", href: "https://example.com" },
      layout: { children: { gap: 12 } }, style: { className: "hero", color: { kind: "palette", colorId: "brand" } },
      typography: { fontSize: 24 }, effect: { opacity: 0.75 }, children: [{ id: "child", type: "text", hidden: false, content: "Child" }],
    });
    const result = createLinkedStyleFromContainer(initial, 0, "container", "Hero");
    expect(result.linkedStyles).toEqual([{
      id: "hero", name: "Hero", layout: { children: { gap: 12 } }, style: { color: { kind: "palette", colorId: "brand" } },
      typography: { fontSize: 24 }, effect: { opacity: 0.75 },
    }]);
    expect(selected(result)).toMatchObject({ id: "container", linkedStyleId: "hero", hidden: true, role: "column", link: { kind: "url", href: "https://example.com" }, style: { className: "hero" } });
    expect(selected(result).children).toHaveLength(1);
    expect(selected(result)).not.toHaveProperty("layout");
    expect(selected(result)).not.toHaveProperty("typography");
    expect(selected(result)).not.toHaveProperty("effect");
    expect(PresentationSchema.safeParse(result).success).toBe(true);
  });

  it("rejects empty creation and allocates unique IDs", () => {
    const empty = presentation({ id: "container", type: "container", hidden: false, children: [] });
    expect(canCreateLinkedStyleFromContainer(selected(empty))).toBe(false);
    expect(createLinkedStyleFromContainer(empty, 0, "container", "Empty")).toEqual(empty);
    const styled = presentation({ id: "container", type: "container", hidden: false, layout: { children: { gap: 2 } }, children: [] }, [{ id: "card", name: "Card", layout: { children: { gap: 1 } } }]);
    expect(createLinkedStyleFromContainer(styled, 0, "container", "Card").linkedStyles?.at(-1)?.id).toBe("card-2");
  });

  it("refuses creation from a linked Container without changing its relationship or local override", () => {
    const initial = presentation({
      id: "container", type: "container", hidden: false, linkedStyleId: "card",
      style: { color: "#111" }, children: [],
    }, [{ id: "card", name: "Card", layout: { children: { gap: 8 } } }]);
    expect(canCreateLinkedStyleFromContainer(selected(initial))).toBe(false);
    const result = createLinkedStyleFromContainer(initial, 0, "container", "Replacement");
    expect(result).toEqual(initial);
    expect(selected(result)).toMatchObject({ linkedStyleId: "card", style: { color: "#111111" } });
    expect(PresentationSchema.safeParse(result).success).toBe(true);
  });

  it("adopts linked ownership for the manual padding and pattern reproduction", () => {
    const pattern = { image: "radial-gradient(#444 1px, transparent 1px)" };
    const initial = presentation({ id: "container", type: "container", hidden: false, layout: { padding: 24 }, children: [] }, [
      { id: "card", name: "Card", layout: { padding: 100 }, style: { background: { pattern } } },
    ]);
    const attached = attachLinkedStyle(initial, 0, "container", "card");
    expect(selected(attached)).not.toHaveProperty("layout.padding");
    expect(resolveLinkedContainerStyle(attached, selected(attached))).toMatchObject({ layout: { padding: 100 }, style: { background: { pattern } } });
  });

  it("preserves unrelated local values, including className and zero-like values", () => {
    const initial = presentation({ id: "container", type: "container", hidden: false, layout: { padding: 0, width: "80%" }, style: { className: "card" }, children: [] }, [
      { id: "card", name: "Card", layout: { padding: 100 } },
    ]);
    const result = attachLinkedStyle(initial, 0, "container", "card");
    expect(selected(result)).not.toHaveProperty("layout.padding");
    expect(selected(result)).toMatchObject({ layout: { width: "80%" }, style: { className: "card" } });
  });

  it("adopts nested properties and atomic values without merging them", () => {
    const pattern = { image: "linear-gradient(#000, #fff)" };
    const initial = presentation({ id: "container", type: "container", hidden: false,
      layout: { children: { gap: 4, direction: "row" } }, style: { background: { pattern: { image: "linear-gradient(#111, #222)" } } }, children: [] }, [
      { id: "card", name: "Card", layout: { children: { gap: 16 } }, style: { background: { pattern } } },
    ]);
    const result = attachLinkedStyle(initial, 0, "container", "card");
    expect(selected(result)).not.toHaveProperty("layout.children.gap");
    expect(selected(result)).toMatchObject({ layout: { children: { direction: "row" } } });
    expect(selected(result)).not.toHaveProperty("style.background.pattern");
    expect(resolveLinkedContainerStyle(result, selected(result))).toMatchObject({ layout: { children: { gap: 16, direction: "row" } }, style: { background: { pattern } } });
  });

  it("adopts each switched style while preserving unrelated locals and position validity", () => {
    const initial = presentation({ id: "container", type: "container", hidden: false, layout: { position: "absolute", top: 20, left: 30, width: "80%" }, style: { color: "#111" }, children: [] }, [
      { id: "a", name: "A", layout: { position: "absolute", top: 10 }, style: { color: "#222" } },
      { id: "b", name: "B", layout: { position: "absolute", top: 40 }, style: { borderRadius: 8 } },
    ]);
    const attached = attachLinkedStyle(initial, 0, "container", "a");
    expect(selected(attached).layout).toEqual({ position: "absolute", left: 30, width: "80%" });
    const switched = attachLinkedStyle(attached, 0, "container", "b");
    expect(selected(switched).layout).toEqual({ position: "absolute", left: 30, width: "80%" });
    expect(selected(switched)).not.toHaveProperty("style.color");
    expect(PresentationSchema.safeParse(switched).success).toBe(true);
  });

  it("detaches by materializing authored linked and local values while preserving palette refs and className", () => {
    const initial = presentation({
      id: "container", type: "container", hidden: false, linkedStyleId: "card",
      style: { className: "local", background: { color: { kind: "palette", colorId: "accent" } } },
      effect: { opacity: 0.5 }, children: [],
    }, [{ id: "card", name: "Card", layout: { children: { gap: 12 } }, style: { color: { kind: "palette", colorId: "brand" }, borderRadius: 8 }, typography: { fontSize: 20 }, effect: { shadow: { x: 0, y: 2, blur: 4, color: "#000" } } }]);
    const result = detachLinkedStyle(initial, 0, "container");
    expect(selected(result)).toMatchObject({
      layout: { children: { gap: 12 } }, style: { className: "local", color: { kind: "palette", colorId: "brand" }, background: { color: { kind: "palette", colorId: "accent" } }, borderRadius: 8 },
      typography: { fontSize: 20 }, effect: { opacity: 0.5, shadow: { x: 0, y: 2, blur: 4, color: "#000000" } },
    });
    expect(selected(result)).not.toHaveProperty("linkedStyleId");
    expect(result.linkedStyles).toEqual(initial.linkedStyles);
    expect(PresentationSchema.safeParse(result).success).toBe(true);
  });

  it("updates a nested selected container without changing its sibling", () => {
    const initial = presentation({ id: "parent", type: "container", hidden: false, children: [
      { id: "nested", type: "container", hidden: false, layout: { children: { gap: 4 } }, children: [] },
      { id: "sibling", type: "text", hidden: false, content: "unchanged" },
    ] });
    const result = createLinkedStyleFromContainer(initial, 0, "nested", "Nested");
    const parent = selected(result);
    expect(parent.children[0]).toMatchObject({ id: "nested", linkedStyleId: "nested" });
    expect(parent.children[1]).toMatchObject({ id: "sibling", content: "unchanged" });
  });

  it("creates from a Container in a Structured Table ContentSlot", () => {
    const initial = presentation({
      id: "table", type: "table", mode: "structured", hidden: false, showHeader: true,
      columns: [{ id: "column", header: { id: "header", children: [{ id: "header-text", type: "text", hidden: false, content: "Header" }] } }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [
        { id: "table-container", type: "container", hidden: false, style: { borderRadius: 8 }, children: [] },
        { id: "cell-sibling", type: "text", hidden: false, content: "Sibling" },
      ] }] }],
    });
    const result = createLinkedStyleFromContainer(initial, 0, "table-container", "Table card");
    expect(findElementById(result.slides[0]!.elements, "table-container")).toMatchObject({ linkedStyleId: "table-card" });
    expect(result.linkedStyles?.[0]).toMatchObject({ id: "table-card", style: { borderRadius: 8 } });
    expect(findElementById(result.slides[0]!.elements, "cell-sibling")).toMatchObject({ content: "Sibling" });
    expect(PresentationSchema.safeParse(result).success).toBe(true);
  });

  it("creates from a Container in Topics content without changing topic siblings", () => {
    const initial = presentation({
      id: "topics", type: "topics", hidden: false, kind: "unordered", items: [{
        id: "topic", content: { id: "topic-slot", children: [
          { id: "topic-container", type: "container", hidden: false, layout: { children: { gap: 6 } }, children: [] },
          { id: "topic-sibling", type: "text", hidden: false, content: "Sibling" },
        ] }, children: [{
          id: "child-topic", content: { id: "child-slot", children: [{ id: "child-text", type: "text", hidden: false, content: "Child" }] }, children: [],
        }],
      }],
    });
    const result = createLinkedStyleFromContainer(initial, 0, "topic-container", "Topic card");
    expect(findElementById(result.slides[0]!.elements, "topic-container")).toMatchObject({ linkedStyleId: "topic-card" });
    expect(result.linkedStyles?.[0]).toMatchObject({ id: "topic-card", layout: { children: { gap: 6 } } });
    expect(findElementById(result.slides[0]!.elements, "topic-sibling")).toMatchObject({ content: "Sibling" });
    expect(findElementById(result.slides[0]!.elements, "child-text")).toMatchObject({ content: "Child" });
    expect(PresentationSchema.safeParse(result).success).toBe(true);
  });
});
