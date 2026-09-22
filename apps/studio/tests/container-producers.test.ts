import { describe, expect, it } from "vitest";

import {
  PresentationElementSchema,
  PresentationSchema,
  type PresentationElement,
} from "@web-slideshow/document-schema";

import { editorDemoPresentation } from "../src/features/editor/editor-demo-presentation";
import { createElement } from "../src/features/editor/element-operations";
import {
  createSlideFromPreset,
  duplicateSlideWithUniqueIds,
  type SlideLayoutPreset,
} from "../src/features/editor/slide-operations";
import { collectPresentationAuthoringIds } from "../src/features/editor/presentation-authoring-trees";

const presets: SlideLayoutPreset[] = [
  "blank",
  "full",
  "centered",
  "title-content",
  "two-columns",
  "three-columns",
  "title-two-columns",
];

function containers(elements: readonly PresentationElement[]): PresentationElement[] {
  return elements.flatMap((element) =>
    element.type === "container"
      ? [element, ...containers(element.children)]
      : [],
  );
}

function expectCanonicalContainers(elements: readonly PresentationElement[]) {
  for (const element of containers(elements)) {
    expect(element).not.toHaveProperty("direction");
    expect(element).not.toHaveProperty("gap");
    expect(element).not.toHaveProperty("distribution");
    expect(element).not.toHaveProperty("horizontalAlign");
    expect(element).not.toHaveProperty("verticalAlign");
    expect(element).not.toHaveProperty("layoutMode");
    expect(element).not.toHaveProperty("style.width");
    expect(element).not.toHaveProperty("style.height");
    expect(element).not.toHaveProperty("style.padding");
    expect(element).not.toHaveProperty("style.backgroundGradient");
    expect(element).not.toHaveProperty("style.backgroundPattern");
    expect(element).not.toHaveProperty("style.opacity");
    expect(element).not.toHaveProperty("style.shadow");
  }
}

describe("Studio canonical Container producers", () => {
  it("creates a schema-valid canonical Container", () => {
    const created = createElement("container", new Set());

    PresentationElementSchema.parse(created);
    expect(created).toMatchObject({
      type: "container",
      layout: {
        width: "70%",
        height: "60%",
        padding: 24,
        children: {
          gap: 16,
          horizontalAlign: "center",
          verticalAlign: "center",
        },
      },
      style: { background: { color: "rgba(15, 23, 42, 0.55)" } },
    });
    expectCanonicalContainers([created]);
  });

  it.each(presets)("creates canonical Containers for the %s preset", (preset) => {
    const slide = createSlideFromPreset(preset, new Set());
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "preset-test",
      title: "Preset test",
      description: "",
      aspectRatio: "16:9",
      slides: [slide],
    });

    expectCanonicalContainers(presentation.slides[0]?.elements ?? []);
  });

  it("preserves representative preset hierarchy and non-Container styles", () => {
    const twoColumns = createSlideFromPreset("two-columns", new Set());
    const root = twoColumns.elements[0];
    expect(root.type).toBe("container");
    if (root.type === "container") {
      expect(root.children).toHaveLength(2);
      expect(root.layout).toMatchObject({
        width: "100%",
        height: "100%",
        padding: 48,
        children: { direction: "row", gap: 32 },
      });
    }

    const full = createSlideFromPreset("full", new Set());
    expect(full.elements[0]).toMatchObject({
      type: "container",
      children: [
        { type: "text" },
        { type: "container" },
      ],
    });
  });

  it("keeps the demo presentation schema-valid with canonical Containers", () => {
    const presentation = PresentationSchema.parse(editorDemoPresentation);
    expectCanonicalContainers(presentation.slides.flatMap((slide) => slide.elements));
    expect(presentation.slides[1]?.elements[0]).toMatchObject({
      type: "container",
      children: [
        { type: "text" },
        { type: "code", layout: { width: "72%" } },
      ],
    });
    expect(presentation.slides[4]?.elements[0]).toMatchObject({
      type: "container",
      children: [{ type: "text" }, { type: "table", layout: { width: "82%" } }],
    });
  });

  it("allocates new slide and preset ids outside Root/local reservations", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "slide-presentation",
      title: "Slides",
      rootDefinitions: [{
        id: "root-definition",
        name: "Root Definition",
        localChildTargetIds: ["root-container"],
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: [
            { id: "slide", type: "text", hidden: false, variant: "body", content: "slide" },
            { id: "slide-2", type: "text", hidden: false, variant: "body", content: "slide-2" },
            { id: "slide-3-root", type: "text", hidden: false, variant: "body", content: "slide-3-root" },
            { id: "slide-3-title", type: "text", hidden: false, variant: "body", content: "slide-3-title" },
          ],
        },
      }],
      slides: [{ id: "existing-slide", title: "", summary: "", speakerNotes: "", elements: [] }],
    });
    const usedIds = collectPresentationAuthoringIds(presentation);
    const created = createSlideFromPreset("full", usedIds);

    expect(created.id).toBe("slide-3");
    expect(created.elements[0]?.id).toBe("slide-3-root-2");
    expect(PresentationSchema.safeParse(presentation).success).toBe(true);
  });

  it("avoids Root/local duplicate bases while preserving historical structural ids", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "duplicate-slide-presentation",
      title: "Slides",
      rootDefinitions: [{
        id: "root-definition",
        name: "Root Definition",
        localChildTargetIds: ["root-container"],
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: [
            { id: "source-slide-copy", type: "text", hidden: false, variant: "body", content: "slide" },
            { id: "source-element-copy", type: "text", hidden: false, variant: "body", content: "element" },
          ],
        },
      }],
      slides: [{
        id: "source-slide",
        title: "Source",
        summary: "",
        speakerNotes: "",
        elements: [{
          id: "source-element",
          type: "container",
          hidden: false,
          children: [{
            id: "source-topics",
            type: "topics",
            hidden: false,
            kind: "unordered",
            items: [{ id: "topic-item", content: { id: "topic-slot", children: [] }, children: [] }],
          }, {
            id: "source-table",
            type: "table",
            mode: "structured",
            hidden: false,
            showHeader: true,
            columns: [{ id: "column", header: { id: "header-slot", children: [] } }],
            rows: [{ id: "row", cells: [{ id: "cell-slot", children: [] }] }],
          }],
        }],
      }],
    });
    const source = presentation.slides[0]!;
    const duplicated = duplicateSlideWithUniqueIds(source, collectPresentationAuthoringIds(presentation));
    const root = duplicated.elements[0];

    expect(duplicated.id).toBe("source-slide-copy-2");
    expect(root?.id).toBe("source-element-copy-2");
    if (root?.type !== "container") return;
    const topics = root.children[0];
    const table = root.children[1];
    expect(topics?.type === "topics" && topics.items[0]?.id).toBe("topic-item");
    expect(topics?.type === "topics" && topics.items[0]?.content.id).toBe("topic-slot");
    expect(table?.type === "table" && table.mode === "structured" && table.columns[0]?.id).toBe("column");
    expect(table?.type === "table" && table.mode === "structured" && table.rows[0]?.id).toBe("row");
  });
});
