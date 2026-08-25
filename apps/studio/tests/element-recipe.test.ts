import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { extractElementRecipeDraft } from "../src/features/editor/element-recipe";

describe("extractElementRecipeDraft", () => {
  it("extracts selected text properties using canonical values", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "title-1",
      hidden: false,
      content: "Introduction",
      variant: "title",
      typography: { fontFamily: "Inter", fontSize: "46px" },
    };

    expect(extractElementRecipeDraft(
      element,
      new Set(["typography.fontSize", "variant", "typography.fontFamily"]),
    )).toEqual({
      type: "text",
      properties: [
        { path: "variant", value: "title" },
        { path: "typography.fontFamily", value: "Inter" },
        { path: "typography.fontSize", value: "46px" },
      ],
    });
  });

  it("omits unselected content and includes it when selected", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "text-1",
      hidden: false,
      content: "Only when selected",
      variant: "body",
    };

    expect(extractElementRecipeDraft(element, new Set(["variant"])).properties)
      .toEqual([{ path: "variant", value: "body" }]);
    expect(extractElementRecipeDraft(element, new Set(["content"])).properties)
      .toEqual([{ path: "content", value: "Only when selected" }]);
  });

  it("includes the element type but never emits identity properties", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "not-in-recipe",
      hidden: false,
      content: "Text",
      variant: "body",
    };

    const draft = extractElementRecipeDraft(
      element,
      new Set(["id", "type", "variant"]),
    );

    expect(draft.type).toBe("text");
    expect(draft.properties).toEqual([{ path: "variant", value: "body" }]);
    expect(draft).not.toHaveProperty("id");
  });

  it("extracts image source and atomic values from their canonical paths", () => {
    const element: PowerShowElement = {
      type: "image",
      id: "image-1",
      hidden: false,
      src: "https://example.com/image.png",
      alt: "Image",
      fit: "cover",
      crop: { x: 10, y: 10, width: 50, height: 50 },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    };

    const draft = extractElementRecipeDraft(
      element,
      new Set(["crop.x", "crop", "link", "src"]),
    );

    expect(draft.properties).toEqual([
      { path: "src", value: "https://example.com/image.png" },
      { path: "link", value: { kind: "url", href: "https://example.com", target: "_blank" } },
      { path: "crop", value: { x: 10, y: 10, width: 50, height: 50 } },
    ]);
  });

  it("extracts authored container layout properties but excludes children", () => {
    const element: PowerShowElement = {
      type: "container",
      id: "container-1",
      hidden: false,
      layout: { children: { gap: "12px" } },
      children: [{ type: "text", id: "child", hidden: false, content: "Child", variant: "body" }],
    };

    const draft = extractElementRecipeDraft(
      element,
      new Set(["children", "layout.children.gap"]),
    );

    expect(draft.properties).toEqual([
      { path: "layout.children.gap", value: "12px" },
    ]);
  });

  it("extracts intrinsic arrays as canonical arrays", () => {
    const element: PowerShowElement = {
      type: "table",
      id: "table-1",
      hidden: false,
      mode: "simple",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "PowerShow" }],
    };

    const draft = extractElementRecipeDraft(element, new Set(["rows"]));

    expect(draft.properties).toEqual([
      { path: "rows", value: [{ name: "PowerShow" }] },
    ]);
  });

  it("ignores unknown, absent, atomic descendant, and stale paths", () => {
    const element: PowerShowElement = {
      type: "image",
      id: "image-1",
      hidden: false,
      src: "image.png",
      alt: "",
      fit: "contain",
      crop: { x: 10, y: 10, width: 50, height: 50 },
    };

    expect(extractElementRecipeDraft(
      element,
      new Set(["does.not.exist", "missing", "crop.x"]),
    )).toEqual({ type: "image", properties: [] });
  });

  it("returns an empty draft for an empty selection", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "text-1",
      hidden: false,
      content: "Text",
      variant: "body",
    };

    expect(extractElementRecipeDraft(element, new Set())).toEqual({
      type: "text",
      properties: [],
    });
  });

  it("deep-clones selected values without mutating source or selection", () => {
    const element: PowerShowElement = {
      type: "table",
      id: "table-1",
      hidden: false,
      mode: "simple",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "PowerShow" }],
    };
    const selectedPaths = new Set(["rows"]);
    const sourceBefore = JSON.stringify(element);

    const draft = extractElementRecipeDraft(element, selectedPaths);
    const recipeRows = draft.properties[0]?.value as Array<Record<string, string>>;
    recipeRows[0]!.name = "Recipe";

    expect(element.rows[0]).toEqual({ name: "PowerShow" });
    element.rows[0]!.name = "Source";
    expect(recipeRows[0]).toEqual({ name: "Recipe" });
    expect(JSON.stringify(element)).not.toBe(sourceBefore);
    expect([...selectedPaths]).toEqual(["rows"]);
  });

  it("deep-clones nested atomic objects", () => {
    const element: PowerShowElement = {
      type: "image",
      id: "image-1",
      hidden: false,
      src: "image.png",
      alt: "",
      fit: "contain",
      crop: { x: 10, y: 10, width: 50, height: 50 },
    };

    const draft = extractElementRecipeDraft(element, new Set(["crop"]));
    const recipeCrop = draft.properties[0]?.value as { x: number };
    recipeCrop.x = 20;

    expect(element.crop?.x).toBe(10);
  });
});
