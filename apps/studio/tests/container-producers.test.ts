import { describe, expect, it } from "vitest";

import {
  PowerShowElementSchema,
  PresentationSchema,
  type PowerShowElement,
} from "@powershow/document-schema";

import { editorDemoPresentation } from "../src/features/editor/editor-demo-presentation";
import { createElement } from "../src/features/editor/element-operations";
import {
  createSlideFromPreset,
  type SlideLayoutPreset,
} from "../src/features/editor/slide-operations";

const presets: SlideLayoutPreset[] = [
  "blank",
  "full",
  "centered",
  "title-content",
  "two-columns",
  "three-columns",
  "title-two-columns",
];

function containers(elements: readonly PowerShowElement[]): PowerShowElement[] {
  return elements.flatMap((element) =>
    element.type === "container"
      ? [element, ...containers(element.children)]
      : [],
  );
}

function expectCanonicalContainers(elements: readonly PowerShowElement[]) {
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
    const created = createElement("container", []);

    PowerShowElementSchema.parse(created);
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
    const slide = createSlideFromPreset(preset, []);
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
    const twoColumns = createSlideFromPreset("two-columns", []);
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

    const full = createSlideFromPreset("full", []);
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
});
