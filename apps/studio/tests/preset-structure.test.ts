import { describe, expect, it } from "vitest";

import type {
  ContainerElement,
  PresentationElement,
  Slide,
} from "@web-slideshow/document-schema";

import {
  buildPresetStructure,
  createRootPresetContainer,
  type SlideLayoutPreset,
} from "../src/features/editor/preset-structure";
import { createSlideFromPreset } from "../src/features/editor/slide-operations";

const presets: SlideLayoutPreset[] = [
  "blank",
  "full",
  "centered",
  "title-content",
  "two-columns",
  "three-columns",
  "title-two-columns",
];

function expectedSlide(
  elements: PresentationElement[],
): Slide {
  return {
    id: "slide",
    title: "Untitled slide",
    summary: "",
    speakerNotes: "",
    background: { color: "#0b1020" },
    elements,
  };
}

function expectedText(
  id: string,
  variant: "title" | "body",
  content: string,
): PresentationElement {
  return { id, type: "text", hidden: false, variant, content };
}

function expectedContainer(
  id: string,
  layout: NonNullable<ContainerElement["layout"]>,
  children: PresentationElement[] = [],
  style?: ContainerElement["style"],
): ContainerElement {
  return {
    id,
    type: "container",
    hidden: false,
    layout,
    ...(style === undefined ? {} : { style }),
    children,
  };
}

function expectedPresetSlide(preset: SlideLayoutPreset): Slide {
  switch (preset) {
    case "blank":
      return expectedSlide([]);
    case "full":
      return expectedSlide([
        expectedContainer("slide-root", {
          width: "100%",
          height: "100%",
          padding: 56,
          children: { direction: "column", gap: 24, horizontalAlign: "stretch", verticalAlign: "stretch" },
        }, [
          expectedText("slide-title", "title", "Slide title"),
          expectedContainer("slide-content", {
            width: "100%",
            height: "100%",
            children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
          }, [expectedText("slide-content-body", "body", "Add your content here.")]),
        ]),
      ]);
    case "centered":
      return expectedSlide([
        expectedContainer("slide-root", {
          width: "100%",
          height: "100%",
          padding: 64,
          children: { direction: "column", gap: 20, horizontalAlign: "center", verticalAlign: "center" },
        }, [
          expectedText("slide-title", "title", "Centered slide"),
          expectedContainer("slide-content", {
            width: "70%",
            children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
          }, [expectedText("slide-content-body", "body", "Add your content here.")]),
        ]),
      ]);
    case "title-content":
      return expectedSlide([
        expectedContainer("slide-root", {
          width: "100%",
          height: "100%",
          padding: 56,
          children: { direction: "column", gap: 32, horizontalAlign: "center", verticalAlign: "center" },
        }, [
          expectedText("slide-title", "title", "Slide title"),
          expectedContainer("slide-content", {
            width: "90%",
            height: "68%",
            padding: 32,
            children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
          }, [expectedText("slide-body", "body", "Add your content here.")], {
            background: { color: "rgba(15, 23, 42, 0.45)" },
          }),
        ]),
      ]);
    case "two-columns":
      return expectedSlide([
        expectedContainer("slide-root", {
          width: "100%",
          height: "100%",
          padding: 48,
          children: { direction: "row", gap: 32, horizontalAlign: "center", verticalAlign: "center" },
        }, [
          expectedContainer("slide-left", {
            width: "47%",
            height: "82%",
            padding: 24,
            children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
          }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } }),
          expectedContainer("slide-right", {
            width: "47%",
            height: "82%",
            padding: 24,
            children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
          }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } }),
        ]),
      ]);
    case "three-columns":
      return expectedSlide([
        expectedContainer("slide-root", {
          width: "100%",
          height: "100%",
          padding: 48,
          children: { direction: "row", gap: 24, horizontalAlign: "center", verticalAlign: "center" },
        }, [
          expectedContainer("slide-column-1", {
            width: "30%",
            height: "82%",
            padding: 20,
            children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
          }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } }),
          expectedContainer("slide-column-2", {
            width: "30%",
            height: "82%",
            padding: 20,
            children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
          }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } }),
          expectedContainer("slide-column-3", {
            width: "30%",
            height: "82%",
            padding: 20,
            children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
          }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } }),
        ]),
      ]);
    case "title-two-columns":
      return expectedSlide([
        expectedContainer("slide-root", {
          width: "100%",
          height: "100%",
          padding: 48,
          children: { direction: "column", gap: 28, horizontalAlign: "center", verticalAlign: "center" },
        }, [
          expectedText("slide-title", "title", "Slide title"),
          expectedContainer("slide-columns", {
            width: "94%",
            height: "70%",
            children: { direction: "row", gap: 28, horizontalAlign: "center", verticalAlign: "center" },
          }, [
            expectedContainer("slide-left", {
              width: "48%",
              height: "100%",
              padding: 24,
              children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
            }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } }),
            expectedContainer("slide-right", {
              width: "48%",
              height: "100%",
              padding: 24,
              children: { direction: "column", gap: 16, horizontalAlign: "center", verticalAlign: "center" },
            }, [], { background: { color: "rgba(15, 23, 42, 0.45)" } }),
          ]),
        ]),
      ]);
  }
}

function withoutIds<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(withoutIds) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .map(([key, entry]) => [key, withoutIds(entry)]),
    ) as T;
  }
  return value;
}

describe("shared preset structural primitive", () => {
  it.each(presets)("preserves the exact Slide output for %s", (preset) => {
    expect(createSlideFromPreset(preset, new Set())).toEqual(expectedPresetSlide(preset));
  });

  it.each(presets.filter((preset) => preset !== "blank"))(
    "keeps the %s tree equivalent for Slide and Root owners",
    (preset) => {
      const slide = createSlideFromPreset(preset, new Set());
      const root = createRootPresetContainer(preset, "root-definition", new Set());

      expect(slide.elements).toHaveLength(1);
      expect(withoutIds(slide.elements[0])).toEqual(withoutIds(root));
    },
  );

  it("keeps blank Slides empty while adapting blank Roots to one empty Container", () => {
    const slide = createSlideFromPreset("blank", new Set());
    const root = createRootPresetContainer("blank", "root-definition", new Set());

    expect(slide.elements).toEqual([]);
    expect(root).toEqual({
      id: "root-definition-root",
      type: "container",
      hidden: false,
      children: [],
    });
  });

  it("preserves deterministic collision suffixing for owner, root, and nested child ids", () => {
    const usedIds = new Set([
      "slide",
      "slide-2-root",
      "slide-2-content-body",
    ]);

    const slide = createSlideFromPreset("full", usedIds);
    const root = slide.elements[0];

    expect(slide.id).toBe("slide-2");
    expect(root?.type === "container" && root.id).toBe("slide-2-root-2");
    expect(root?.type === "container" && root.children[1]?.type === "container" && root.children[1].id).toBe("slide-2-content");
    expect(root?.type === "container" && root.children[1]?.type === "container" && root.children[1].children[0]?.id).toBe("slide-2-content-body-2");
  });

  it("does not mutate the produced structural tree through later builds", () => {
    const first = buildPresetStructure("two-columns", "owner-a", new Set());
    const second = buildPresetStructure("two-columns", "owner-b", new Set());

    expect(first).not.toBe(second);
    expect(first?.children[0]).not.toBe(second?.children[0]);
    expect(first?.children).toHaveLength(2);
    expect(second?.children).toHaveLength(2);
  });
});
