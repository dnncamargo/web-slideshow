import { describe, expect, it } from "vitest";

import { PresentationSchema, resolveLinkedTopicsStyle, type Presentation } from "@powershow/document-schema";

import {
  attachLinkedTopicsStyle,
  canCreateLinkedStyleFromTopics,
  createLinkedStyleFromTopics,
  detachLinkedTopicsStyle,
  removeUnusedLinkedStyle,
  updateLinkedTopicsStyle,
} from "../src/features/editor/linked-style-authoring";

function topics(properties: Record<string, unknown> = {}, children: object[] = []): object {
  return {
    id: "topics", type: "topics", hidden: false, kind: "unordered",
    items: [{ id: "item", content: { id: "content", children }, children: [] }],
    ...properties,
  };
}

function presentation(element: object, linkedStyles: object[] = []): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1, id: "presentation", title: "Presentation",
    slides: [{ id: "slide", title: "", elements: [element] }], linkedStyles,
  });
}

function selected(document: Presentation) {
  const element = document.slides[0]!.elements[0];
  if (element?.type !== "topics") throw new Error("Expected Topics element.");
  return element;
}

describe("Topics Linked Style authoring", () => {
  it("creates a typed resource, transfers only allowed properties, and preserves content", () => {
    const initial = presentation(topics({
      layout: { margin: 12 }, rootMarkerStyle: "square", markerColor: "#112233", itemGap: 8,
      style: { color: "#445566" }, typography: { fontSize: 24 },
    }));
    const result = createLinkedStyleFromTopics({ ...initial, linkedStyles: [{ id: "topics", name: "Topics", layout: { margin: 4 } }] }, 0, "topics", "Topics");
    expect(result.linkedStyles).toEqual([{ id: "topics", name: "Topics", layout: { margin: 4 } }, { target: "topics", id: "topics-2", name: "Topics", layout: { margin: 12 }, rootMarkerStyle: "square", markerColor: "#112233", itemGap: 8 }]);
    expect(selected(result)).toMatchObject({ linkedStyleId: "topics-2", style: { color: "#445566" }, typography: { fontSize: 24 } });
    expect(selected(result)).not.toHaveProperty("layout");
    expect(selected(result)).not.toHaveProperty("rootMarkerStyle");
    expect(selected(result).items).toEqual(selected(initial).items);
    expect(PresentationSchema.safeParse(result).success).toBe(true);
  });

  it("strips default-equivalent Topics margins while preserving customized properties", () => {
    const initial = presentation(topics({
      layout: { margin: 0, marginTop: "0px", marginRight: 12 },
      rootMarkerStyle: "disc", itemGap: 6,
    }));
    const result = createLinkedStyleFromTopics(initial, 0, "topics", "Sparse");
    const linked = result.linkedStyles?.[0];
    expect(linked).not.toHaveProperty("layout.margin");
    expect(linked).not.toHaveProperty("layout.marginTop");
    expect(linked).toHaveProperty("layout.marginRight", 12);
    expect(linked).not.toHaveProperty("rootMarkerStyle");
    expect(linked).not.toHaveProperty("itemGap");
    expect(JSON.stringify(linked)).not.toContain("undefined");
  });

  it("creates an ordered kind-only resource without persisting decimal", () => {
    const initial = presentation(topics({ kind: "ordered", rootMarkerStyle: "decimal" }));

    expect(canCreateLinkedStyleFromTopics(selected(initial))).toBe(true);
    const result = createLinkedStyleFromTopics(initial, 0, "topics", "Ordered");
    expect(result.linkedStyles).toEqual([{ target: "topics", id: "ordered", name: "Ordered", kind: "ordered" }]);
    expect(selected(result)).not.toHaveProperty("kind");
    expect(selected(result).items).toEqual(selected(initial).items);
  });

  it("removes Topics resource properties by absence rather than explicit undefined", () => {
    const initial = presentation(topics({}), [
      { target: "topics", id: "shared", name: "Shared", layout: { margin: 12 }, rootMarkerStyle: "square", markerColor: "#112233", itemGap: 8 },
    ]);
    const result = updateLinkedTopicsStyle(initial, "shared", { layout: undefined, markerColor: undefined, itemGap: undefined });
    const linked = result.linkedStyles?.[0];
    expect(linked).not.toHaveProperty("layout");
    expect(linked).not.toHaveProperty("markerColor");
    expect(linked).not.toHaveProperty("itemGap");
    expect(linked).toHaveProperty("rootMarkerStyle", "square");
  });

  it("defensively rejects removing the final authored property", () => {
    const initial = presentation(topics({ itemGap: 8 }), [
      { target: "topics", id: "shared", name: "Shared", itemGap: 8 },
    ]);
    expect(updateLinkedTopicsStyle(initial, "shared", { itemGap: undefined })).toEqual(initial);
    expect(initial.linkedStyles?.[0]).not.toHaveProperty("layout");
  });

  it("attaches only a Topics resource and preserves unrelated local overrides", () => {
    const initial = presentation(topics({ layout: { margin: 20, top: 4, position: "absolute" }, markerColor: "#ffffff", itemGap: 12 }), [
      { target: "topics", id: "shared", name: "Shared", layout: { margin: 12 }, markerColor: "#112233" },
      { id: "container", name: "Container", layout: { margin: 12 } },
    ]);
    const attached = attachLinkedTopicsStyle(initial, 0, "topics", "shared");
    expect(selected(attached)).toMatchObject({ linkedStyleId: "shared", layout: { top: 4, position: "absolute" } });
    expect(selected(attached)).not.toHaveProperty("markerColor");
    expect(selected(attached)).not.toHaveProperty("layout.margin");
    expect(selected(attached)).toMatchObject({ itemGap: 12 });
    expect(selected(attached)).not.toHaveProperty("rootMarkerStyle");
    expect(attached.linkedStyles).toHaveLength(2);
    expect(attachLinkedTopicsStyle(initial, 0, "topics", "container")).toEqual(initial);
  });

  it("transfers, updates, overrides, and detaches effective kind", () => {
    const initial = presentation(topics({ kind: "unordered" }), [
      { target: "topics", id: "shared", name: "Shared", kind: "ordered", itemGap: 8 },
    ]);
    const attached = attachLinkedTopicsStyle(initial, 0, "topics", "shared");
    expect(selected(attached)).not.toHaveProperty("kind");
    expect(resolveLinkedTopicsStyle(attached, selected(attached)).kind).toBe("ordered");

    const overridden = {
      ...attached,
      slides: attached.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((element) => element.type === "topics" ? { ...element, kind: "unordered" as const } : element),
      })),
    };
    const updated = updateLinkedTopicsStyle(overridden, "shared", { kind: "unordered" });
    expect(updated.linkedStyles?.[0]).not.toHaveProperty("kind");
    expect(resolveLinkedTopicsStyle(updated, selected(updated)).kind).toBe("unordered");

    const restored = updateLinkedTopicsStyle(updated, "shared", { kind: "ordered" });
    expect(restored.linkedStyles?.[0]).toMatchObject({ kind: "ordered" });
    expect(resolveLinkedTopicsStyle(restored, selected(restored)).kind).toBe("unordered");

    const detached = detachLinkedTopicsStyle(attachLinkedTopicsStyle(initial, 0, "topics", "shared"), 0, "topics");
    expect(selected(detached)).toMatchObject({ kind: "ordered" });
    expect(selected(detached)).not.toHaveProperty("linkedStyleId");
  });

  it("updates the resource and resolves the new baseline without rewriting the element", () => {
    const initial = presentation(topics({ linkedStyleId: "shared", layout: { margin: 20 } }), [
      { target: "topics", id: "shared", name: "Shared", layout: { margin: 12 }, itemGap: 4 },
    ]);
    const result = updateLinkedTopicsStyle(initial, "shared", { layout: { margin: 16 }, itemGap: 8 });
    expect(result.linkedStyles?.[0]).toMatchObject({ layout: { margin: 16 }, itemGap: 8 });
    expect(selected(result).layout).toEqual({ margin: 20 });
    expect(resolveLinkedTopicsStyle(result, selected(result))).toMatchObject({ layout: { margin: 20 }, itemGap: 8 });
    const withContainer = { ...initial, linkedStyles: [...(initial.linkedStyles ?? []), { id: "container", name: "Container", layout: { margin: 4 } }] };
    expect(updateLinkedTopicsStyle(withContainer, "container", { layout: { margin: 18 } })).toEqual(withContainer);
  });

  it("detaches by materializing effective Topics properties and keeps the resource", () => {
    const initial = presentation(topics({ linkedStyleId: "shared", layout: { margin: 20 }, itemGap: 8, style: { color: "#fff" }, typography: { fontSize: 18 } }), [
      { target: "topics", id: "shared", name: "Shared", layout: { margin: 12 }, markerColor: "#112233", itemGap: 4 },
    ]);
    const result = detachLinkedTopicsStyle(initial, 0, "topics");
    expect(selected(result)).toMatchObject({ layout: { margin: 20 }, markerColor: "#112233", itemGap: 8, style: { color: "#ffffff" }, typography: { fontSize: 18 } });
    expect(selected(result)).not.toHaveProperty("linkedStyleId");
    expect(result.linkedStyles).toEqual(initial.linkedStyles);
    expect(selected(result).items).toEqual(selected(initial).items);
  });

  it("counts direct and nested Topics references for protected removal", () => {
    const nested = topics({ linkedStyleId: "nested" });
    const initial = presentation(topics({ linkedStyleId: "root", items: [{ id: "item", content: { id: "content", children: [nested] }, children: [] }] }), [
      { target: "topics", id: "root", name: "Root", itemGap: 4 },
      { target: "topics", id: "nested", name: "Nested", itemGap: 4 },
      { target: "topics", id: "unused", name: "Unused", itemGap: 4 },
    ]);
    expect(removeUnusedLinkedStyle(initial, "root")).toBeUndefined();
    expect(removeUnusedLinkedStyle(initial, "nested")).toBeUndefined();
    expect(removeUnusedLinkedStyle(initial, "unused")?.linkedStyles).toHaveLength(2);
  });
});
