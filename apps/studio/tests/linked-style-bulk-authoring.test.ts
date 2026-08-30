import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  resolveLinkedContainerStyle,
  type Presentation,
} from "@powershow/document-schema";

import {
  attachLinkedStyleToMatchingContainers,
  findContainersLinkedToStyle,
  findMatchingContainersForLinkedStyle,
} from "../src/features/editor/linked-style-bulk-authoring";
import { findElementById } from "../src/features/editor/element-tree";

function presentation(elements: object[], linkedStyles: object[], extraSlides: object[][] = []): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    palette: { colors: [{ id: "brand", name: "Brand", value: "#112233" }] },
    linkedStyles,
    slides: [
      { id: "slide-0", title: "One", elements },
      ...extraSlides.map((slideElements, index) => ({ id: `slide-${index + 1}`, title: "Other", elements: slideElements })),
    ],
  });
}

function container(id: string, properties: object = {}, children: object[] = []): object {
  return { id, type: "container", hidden: false, ...properties, children };
}

function linked(id: string, properties: object): object {
  return { id, name: id, ...properties };
}

function getContainer(document: Presentation, slideIndex: number, id: string) {
  const found = findElementById(document.slides[slideIndex]!.elements, id);
  if (found?.type !== "container") throw new Error(`Missing container ${id}`);
  return found;
}

describe("linked style bulk authoring", () => {
  it("discovers root, nested, multi-slide, table-slot, and recursive Topics containers in order", () => {
    const document = presentation([
      container("root", { layout: { children: { gap: 16 } } }, [container("nested", { layout: { children: { gap: 16 } } })]),
      { id: "table", type: "table", mode: "structured", hidden: false, showHeader: true,
        columns: [{ id: "column", header: { id: "header", children: [container("header-match", { layout: { children: { gap: 16 } } })] } }],
        rows: [{ id: "row", cells: [{ id: "cell", children: [container("cell-match", { layout: { children: { gap: 16 } } })] }] }], },
      { id: "topics", type: "topics", hidden: false, kind: "unordered", items: [{ id: "item", content: { id: "slot", children: [container("topic-match", { layout: { children: { gap: 16 } } })] }, children: [{ id: "nested-item", content: { id: "nested-slot", children: [container("recursive-match", { layout: { children: { gap: 16 } } })] }, children: [] }] }] },
    ], [linked("gap", { layout: { children: { gap: 16 } } })], [[container("other-slide", { layout: { children: { gap: 16 } } })]]);

    expect(findMatchingContainersForLinkedStyle(document, "gap")).toEqual([
      { slideIndex: 0, elementId: "root" }, { slideIndex: 0, elementId: "nested" },
      { slideIndex: 0, elementId: "header-match" }, { slideIndex: 0, elementId: "cell-match" },
      { slideIndex: 0, elementId: "topic-match" }, { slideIndex: 0, elementId: "recursive-match" },
      { slideIndex: 1, elementId: "other-slide" },
    ]);
  });

  it("uses authored subset equality, presence, link status, and exact canonical values", () => {
    const document = presentation([
      container("subset", { layout: { children: { gap: 16 }, padding: 24 }, style: { className: "local" } }),
      container("mismatch", { layout: { children: { gap: 12 } } }),
      container("absent"),
      container("same-link", { linkedStyleId: "gap" }),
      container("other-link", { linkedStyleId: "other" }),
      container("string-length", { layout: { children: { gap: "16px" } } }),
    ], [linked("gap", { layout: { children: { gap: 16 } } }), linked("other", { layout: { children: { gap: 12 } } })]);

    expect(findMatchingContainersForLinkedStyle(document, "gap")).toEqual([{ slideIndex: 0, elementId: "subset" }]);
    expect(findContainersLinkedToStyle(document, "gap")).toEqual([{ slideIndex: 0, elementId: "same-link" }]);
  });

  it("matches false-like values and palette references, while preserving className and extra authored values", () => {
    const document = presentation([container("match", {
      layout: { flexShrink: 0, children: { gap: 16 } },
      style: { color: { kind: "palette", colorId: "brand" }, borderRadius: 12, className: "keep" },
      typography: { fontSize: 24, textDecorationLine: "underline", textStroke: { width: 1, color: "#fff" } },
      effect: { opacity: 0 },
    })], [linked("style", {
      layout: { flexShrink: 0, children: { gap: 16 } },
      style: { color: { kind: "palette", colorId: "brand" }, borderRadius: 12 },
      typography: { fontSize: 24, textStroke: { width: 1, color: "#fff" } },
      effect: { opacity: 0 },
    })]);
    const result = attachLinkedStyleToMatchingContainers(document, "style");
    expect(result.attachedLocations).toEqual([{ slideIndex: 0, elementId: "match" }]);
    expect(getContainer(result.presentation, 0, "match")).toMatchObject({ linkedStyleId: "style", style: { className: "keep" }, typography: { textDecorationLine: "underline" } });
    expect(getContainer(result.presentation, 0, "match")).not.toHaveProperty("layout.children.gap");
    expect(getContainer(result.presentation, 0, "match")).not.toHaveProperty("style.borderRadius");
    expect(getContainer(result.presentation, 0, "match")).not.toHaveProperty("typography.textStroke");
    expect(getContainer(result.presentation, 0, "match")).not.toHaveProperty("effect.opacity");
  });

  it("transfers atomic Fit and visual objects only on exact matches", () => {
    const gradient = { type: "linear", stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 100 }] };
    const fit = { mode: "contain", sourceWidth: 800, sourceHeight: 600 };
    const document = presentation([
      container("match", { layout: { children: { fit }, }, style: { background: { gradient }, }, effect: { shadow: { x: 0, y: 1, blur: 2, color: "#000" } } }),
      container("different-fit", { layout: { children: { fit: { ...fit, sourceWidth: 801 } } } }),
    ], [linked("visual", { layout: { children: { fit } }, style: { background: { gradient } }, effect: { shadow: { x: 0, y: 1, blur: 2, color: "#000000" } } })]);
    const result = attachLinkedStyleToMatchingContainers(document, "visual");
    expect(result.attachedLocations).toEqual([{ slideIndex: 0, elementId: "match" }]);
    expect(getContainer(result.presentation, 0, "match")).not.toHaveProperty("layout.children.fit");
    expect(getContainer(result.presentation, 0, "match")).not.toHaveProperty("style.background");
    expect(getContainer(result.presentation, 0, "match")).not.toHaveProperty("effect");
  });

  it("preserves valid positioning for an extra local edge and keeps the definition immutable", () => {
    const document = presentation([container("positioned", { layout: { position: "absolute", top: 10, left: 20 } })], [linked("position", { layout: { position: "absolute", top: 10 } })]);
    const before = structuredClone(document.linkedStyles);
    const first = attachLinkedStyleToMatchingContainers(document, "position");
    expect(first.attachedLocations).toEqual([{ slideIndex: 0, elementId: "positioned" }]);
    expect(getContainer(first.presentation, 0, "positioned").layout).toEqual({ position: "absolute", left: 20 });
    expect(first.presentation.linkedStyles).toEqual(before);
    expect(PresentationSchema.safeParse(first.presentation).success).toBe(true);

    const second = attachLinkedStyleToMatchingContainers(first.presentation, "position");
    expect(second.attachedLocations).toEqual([]);
    expect(second.presentation).toEqual(first.presentation);
  });

  it("returns stable no-ops for unknown styles and zero matches", () => {
    const document = presentation([container("unmatched", { layout: { children: { gap: 12 } } })], [linked("gap", { layout: { children: { gap: 16 } } })]);
    expect(attachLinkedStyleToMatchingContainers(document, "missing")).toEqual({ presentation: document, attachedLocations: [] });
    expect(attachLinkedStyleToMatchingContainers(document, "gap")).toEqual({ presentation: document, attachedLocations: [] });
  });

  it("retains the effective linked values after transfer", () => {
    const document = presentation([container("card", { layout: { children: { gap: 16 }, padding: 24 }, style: { borderRadius: 12 } })], [linked("card-style", { layout: { children: { gap: 16 } }, style: { borderRadius: 12 } })]);
    const result = attachLinkedStyleToMatchingContainers(document, "card-style").presentation;
    const card = getContainer(result, 0, "card");
    expect(resolveLinkedContainerStyle(result, card)).toMatchObject({ layout: { children: { gap: 16 }, padding: 24 }, style: { borderRadius: 12 } });
  });
});
