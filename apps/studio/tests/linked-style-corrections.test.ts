import { describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";
import { collectLinkedStyleReferenceCounts } from "../src/features/editor/element-hierarchy";
import { createLinkedStyleFromContainer, removeUnusedLinkedStyle, renameLinkedStyle, updateLinkedStyle } from "../src/features/editor/linked-style-authoring";
import { getContainerPropertySource, getContainerShareablePropertySource } from "../src/features/editor/inspector/linked-style-inspector";

const presentation = (elements: Presentation["slides"][number]["elements"]): Presentation => PresentationSchema.parse({
  schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements }], linkedStyles: [{ id: "card", name: "Card", layout: { children: { gap: 12 } } }],
});

describe("Linked Style correction contracts", () => {
  it("counts root and nested container references without mutating the document", () => {
    const document = presentation([{ id: "root", type: "container", hidden: false, linkedStyleId: "card", children: [{ id: "child", type: "container", hidden: false, linkedStyleId: "card", children: [] }] }]);
    expect(Object.fromEntries(collectLinkedStyleReferenceCounts(document.slides[0]!.elements))).toEqual({ card: 2 });
    expect(document.slides[0]!.elements[0]).toMatchObject({ id: "root", linkedStyleId: "card" });
  });

  it("trims names, preserves IDs, allows duplicates, and rejects blank names", () => {
    const document = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "a", name: "A", layout: { children: { gap: 1 } } }, { id: "b", name: "B", layout: { children: { gap: 2 } } }] });
    const renamed = renameLinkedStyle(document, "a", "  Same  ");
    const duplicate = renameLinkedStyle(renamed, "b", "Same");
    expect(duplicate.linkedStyles?.map((style) => [style.id, style.name])).toEqual([["a", "Same"], ["b", "Same"]]);
    expect(renameLinkedStyle(duplicate, "a", "   ")).toBe(duplicate);
  });

  it("blocks in-use removal, removes unused final styles, and preserves linked containers on edits", () => {
    const linked = presentation([{ id: "c", type: "container", hidden: false, linkedStyleId: "card", children: [] }]);
    const withStyle = linked;
    expect(removeUnusedLinkedStyle(withStyle, "card")).toBeUndefined();
    const unused = PresentationSchema.parse({ schemaVersion: 1, id: "u", title: "U", slides: [{ id: "s", title: "S", elements: [] }] });
    const withUnused = PresentationSchema.parse({ ...unused, linkedStyles: [{ id: "card", name: "Card", layout: { children: { gap: 12 } } }] });
    expect(removeUnusedLinkedStyle(withUnused, "card")?.linkedStyles).toBeUndefined();
    const edited = updateLinkedStyle(withStyle, "card", { layout: { children: { gap: 24 } } });
    expect(edited.slides[0]!.elements[0]).toMatchObject({ linkedStyleId: "card" });
    expect(edited.linkedStyles?.[0]?.layout?.children?.gap).toBe(24);
  });

  it("keeps source based on authorship and preserves string Length values", () => {
    const document = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [{ id: "c", type: "container", hidden: false, linkedStyleId: "card", style: { borderRadius: 16 }, children: [] }] }], palette: { colors: [{ id: "accent", name: "Accent", value: "#fff" }] }, linkedStyles: [{ id: "card", name: "Card", layout: { children: { gap: 12 } }, style: { borderRadius: "1rem", color: { kind: "palette", colorId: "accent" } } }] });
    const container = document.slides[0]!.elements[0]!;
    expect(container.type).toBe("container");
    if (container.type !== "container") return;
    expect(getContainerPropertySource(document, container, "gap").source).toBe("linked");
    expect(getContainerPropertySource(document, container, "borderRadius")).toMatchObject({ source: "local", linkedValue: "1rem" });
    expect(getContainerShareablePropertySource(document, container, "style.color").linkedValue).toEqual({ kind: "palette", colorId: "accent" });
  });

  it("reuses create-from-container semantics and never transfers className", () => {
    const document = presentation([{ id: "c", type: "container", hidden: false, style: { className: "local", color: "#fff" }, children: [] }]);
    const next = createLinkedStyleFromContainer(document, 0, "c", " Card ");
    expect(next.linkedStyles?.[1]?.style).toEqual({ color: "#ffffff" });
    expect(next.slides[0]!.elements[0]).toMatchObject({ linkedStyleId: "card-2", style: { className: "local" } });
  });
});
