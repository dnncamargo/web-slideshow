import { describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";
import { collectLinkedStyleReferenceCounts } from "../src/features/editor/element-hierarchy";
import { canUpdateLinkedStyle, createLinkedStyleFromContainer, removeUnusedLinkedStyle, renameLinkedStyle, updateLinkedStyle } from "../src/features/editor/linked-style-authoring";
import { getContainerShareablePropertySource } from "../src/features/editor/inspector/linked-style-inspector";
import { containerLinkedStyle } from "./linked-style-test-helpers";

const presentation = (elements: Presentation["slides"][number]["elements"]): Presentation => PresentationSchema.parse({
  schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements }], linkedStyles: [{ id: "card", name: "Card", layout: { children: { gap: 12 } } }],
});

describe("Linked Style correction contracts", () => {
  it("counts root and nested container references without mutating the document", () => {
    const document = presentation([{ id: "root", type: "container", hidden: false, linkedStyleId: "card", children: [{ id: "child", type: "container", hidden: false, linkedStyleId: "card", children: [] }] }]);
    expect(Object.fromEntries(collectLinkedStyleReferenceCounts(document.slides[0]!.elements))).toEqual({ card: 2 });
    expect(document.slides[0]!.elements[0]).toMatchObject({ id: "root", linkedStyleId: "card" });
  });

  it("counts every supported Linked Style element reference", () => {
    const document = PresentationSchema.parse({
      schemaVersion: 1,
      id: "p",
      title: "P",
      linkedStyles: [
        { target: "code", id: "code", name: "Code", style: { color: "#fff" } },
        { target: "terminal", id: "terminal", name: "Terminal", style: { commandColor: "#fff" } },
        { target: "table", mode: "simple", id: "simple", name: "Simple", typography: { fontSize: 14 } },
        { target: "table", mode: "structured", id: "structured", name: "Structured", style: { headerBackground: "#fff" } },
        { target: "divider", id: "divider", name: "Divider", style: { background: { color: "#fff" } } },
      ],
      slides: [{ id: "s", title: "S", elements: [
        { id: "code", type: "code", code: "x", linkedStyleId: "code" },
        { id: "terminal", type: "terminal", lines: [], linkedStyleId: "terminal" },
        { id: "simple", type: "table", columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], linkedStyleId: "simple" },
        {
          id: "structured", type: "table", mode: "structured", linkedStyleId: "structured",
          columns: [{ id: "column", header: { id: "header", children: [] } }],
          rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
        },
        { id: "divider", type: "divider", linkedStyleId: "divider" },
      ] }],
    });
    expect(Object.fromEntries(collectLinkedStyleReferenceCounts(document.slides[0]!.elements))).toEqual({
      code: 1,
      terminal: 1,
      simple: 1,
      structured: 1,
      divider: 1,
    });
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
    expect(containerLinkedStyle(edited.linkedStyles?.[0])?.layout?.children?.gap).toBe(24);
  });

  it.each([
    ["Root Definition", {
      id: "root-container", type: "container", hidden: false, linkedStyleId: "card", children: [],
    }],
    ["local Root child", {
      id: "local-container", type: "container", hidden: false, linkedStyleId: "card", children: [],
    }],
  ] as const)("protects a Linked Style referenced only by a %s", (_label, usedElement) => {
    const document = PresentationSchema.parse({
      schemaVersion: 1,
      id: "p",
      title: "P",
      linkedStyles: [{ id: "card", name: "Card", layout: { children: { gap: 12 } } }],
      rootDefinitions: [{
        id: "root-definition",
        name: "Root Definition",
        localChildTargetIds: ["root-container"],
        root: _label === "Root Definition"
          ? usedElement
          : { id: "root-container", type: "container", hidden: false, children: [] },
      }],
      defaultRootDefinitionId: "root-definition",
      slides: [{
        id: "slide",
        title: "",
        elements: [],
        rootDefinitionId: "root-definition",
        ...(_label === "local Root child" ? {
          localRootChildren: [{ targetContainerId: "root-container", children: [usedElement] }],
        } : {}),
      }],
    });

    expect(removeUnusedLinkedStyle(document, "card")).toBeUndefined();
  });

  it("keeps source based on authorship and preserves string Length values", () => {
    const document = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [{ id: "c", type: "container", hidden: false, linkedStyleId: "card", style: { borderRadius: 16 }, children: [] }] }], palette: { colors: [{ id: "accent", name: "Accent", value: "#fff" }] }, linkedStyles: [{ id: "card", name: "Card", layout: { children: { gap: 12 } }, style: { borderRadius: "1rem", color: { kind: "palette", colorId: "accent" } } }] });
    const container = document.slides[0]!.elements[0]!;
    expect(container.type).toBe("container");
    if (container.type !== "container") return;
    expect(getContainerShareablePropertySource(document, container, "layout.children.gap").source).toBe("linked");
    expect(getContainerShareablePropertySource(document, container, "style.borderRadius")).toMatchObject({ source: "local", linkedValue: "1rem" });
    expect(getContainerShareablePropertySource(document, container, "style.color").linkedValue).toEqual({ kind: "palette", colorId: "accent" });
  });

  it("reuses create-from-container semantics and never transfers className", () => {
    const document = presentation([{ id: "c", type: "container", hidden: false, style: { className: "local", color: "#fff" }, children: [] }]);
    const next = createLinkedStyleFromContainer(document, 0, "c", " Card ");
    expect(next.linkedStyles?.[1]?.style).toEqual({ color: "#ffffff" });
    expect(next.slides[0]!.elements[0]).toMatchObject({ linkedStyleId: "card-2", style: { className: "local" } });
  });

  it("preserves Fit geometry, enforces positioning cleanup, and toggles flex shrink", () => {
    const document = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "card", name: "Card", layout: { position: "absolute", top: 1, right: 2, bottom: 3, left: 4, flexShrink: 0, width: "20%", children: { fit: { mode: "contain", sourceWidth: 800, sourceHeight: 600 } } } }] });
    const currentStyle = containerLinkedStyle(document.linkedStyles?.[0]);
    const changed = updateLinkedStyle(document, "card", { layout: { ...currentStyle?.layout, position: undefined, top: undefined, right: undefined, bottom: undefined, left: undefined, flexShrink: undefined, children: { ...currentStyle?.layout?.children, fit: { mode: "cover", sourceWidth: 800, sourceHeight: 600 } } } });
    expect(containerLinkedStyle(changed.linkedStyles?.[0])?.layout).toMatchObject({ width: "20%", children: { fit: { mode: "cover", sourceWidth: 800, sourceHeight: 600 } } });
    expect(changed.linkedStyles?.[0]?.layout).not.toHaveProperty("position");
    expect(changed.linkedStyles?.[0]?.layout).not.toHaveProperty("flexShrink");
    expect(canUpdateLinkedStyle(changed, "card", { layout: { children: {} } })).toBe(false);
  });

  it("does not update or attach a target-specific style through Container authoring", () => {
    const document = PresentationSchema.parse({
      schemaVersion: 1,
      id: "target-style",
      title: "Target style",
      slides: [{ id: "s", title: "S", elements: [{ id: "candidate", type: "container", hidden: false, style: { color: "#fff" }, children: [] }] }],
      linkedStyles: [{ target: "code", id: "code-style", name: "Code style", style: { color: "#fff" } }],
    });

    expect(canUpdateLinkedStyle(document, "code-style", { style: { color: "#000" } })).toBe(false);
    expect(updateLinkedStyle(document, "code-style", { style: { color: "#000" } })).toBe(document);
  });
});
