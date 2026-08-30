import { describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import {
  attachLinkedStyle,
  canCreateLinkedStyleFromContainer,
  createLinkedStyleFromContainer,
  detachLinkedStyle,
} from "../src/features/editor/linked-style-authoring";

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

  it("attaches and switches without removing local overrides", () => {
    const initial = presentation({ id: "container", type: "container", hidden: false, layout: { children: { gap: 9 } }, style: { color: "#111" }, children: [] }, [
      { id: "a", name: "A", layout: { children: { gap: 4 } } }, { id: "b", name: "B", style: { color: "#222" } },
    ]);
    const attached = attachLinkedStyle(initial, 0, "container", "a");
    const switched = attachLinkedStyle(attached, 0, "container", "b");
    expect(selected(switched)).toMatchObject({ linkedStyleId: "b", layout: { children: { gap: 9 } }, style: { color: "#111111" } });
    expect(switched.linkedStyles).toEqual(initial.linkedStyles);
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
});
