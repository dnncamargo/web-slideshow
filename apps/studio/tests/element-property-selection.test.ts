import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { getSelectableElementProperties } from "../src/features/editor/element-property-selection";

const properties = (element: PowerShowElement) =>
  Object.fromEntries(
    getSelectableElementProperties(element).map((property) => [property.path, property]),
  );

describe("getSelectableElementProperties", () => {
  it("keeps every authored ColorValue atomic", () => {
    const reference = { kind: "palette" as const, colorId: "accent" };
    const textResult = properties({
      type: "text",
      id: "text",
      hidden: false,
      variant: "body",
      content: "Text",
      style: {
        color: reference,
        background: { color: reference },
        border: { width: 1, color: reference },
      },
      typography: { textDecorationColor: reference },
    });
    const topicsResult = properties({
      type: "topics",
      id: "topics",
      hidden: false,
      kind: "unordered",
      items: [],
      markerColor: reference,
    });

    expect(textResult["style.color"]?.kind).toBe("atomic-object");
    expect(textResult["style.background.color"]?.kind).toBe("atomic-object");
    expect(textResult["style.border.color"]?.kind).toBe("atomic-object");
    expect(textResult["typography.textDecorationColor"]?.kind).toBe("atomic-object");
    expect(textResult["style.color.kind"]).toBeUndefined();
    expect(textResult["style.color.colorId"]).toBeUndefined();
    expect(textResult["style.background.color.kind"]).toBeUndefined();
    expect(textResult["style.background.color.colorId"]).toBeUndefined();
    expect(textResult["style.border.color.kind"]).toBeUndefined();
    expect(textResult["style.border.color.colorId"]).toBeUndefined();
    expect(textResult["typography.textDecorationColor.kind"]).toBeUndefined();
    expect(textResult["typography.textDecorationColor.colorId"]).toBeUndefined();
    expect(topicsResult.markerColor?.kind).toBe("atomic-object");
    expect(topicsResult["markerColor.kind"]).toBeUndefined();
    expect(topicsResult["markerColor.colorId"]).toBeUndefined();
  });

  it("keeps literal ColorValue paths atomic and unique", () => {
    const result = getSelectableElementProperties({
      type: "text",
      id: "text",
      hidden: false,
      variant: "body",
      content: "Text",
      style: {
        color: "#111111",
        background: { color: "#ffffff" },
        border: { width: 1, color: "#222222" },
      },
      typography: { textDecorationColor: "#333333" },
    });
    const paths = result.map((property) => property.path);

    expect(new Set(paths).size).toBe(paths.length);
    for (const path of [
      "style.color",
      "style.background.color",
      "style.border.color",
      "typography.textDecorationColor",
    ]) {
      expect(result.filter((property) => property.path === path)).toHaveLength(1);
      expect(result.find((property) => property.path === path)?.kind).toBe("atomic-object");
    }
  });

  it("keeps literal markerColor atomic and unique", () => {
    const result = getSelectableElementProperties({
      type: "topics",
      id: "topics",
      hidden: false,
      kind: "unordered",
      items: [],
      markerColor: "#444444",
    });
    const paths = result.map((property) => property.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect(result.filter((property) => property.path === "markerColor")).toHaveLength(1);
    expect(result.find((property) => property.path === "markerColor")?.kind).toBe("atomic-object");
  });

  it("selects authored visual and layout leaves, but not identity or absent values", () => {
    const element: PowerShowElement = {
      type: "text",
      id: "hero-title",
      hidden: false,
      variant: "title",
      content: "Hello",
      layout: { position: "absolute", left: "5%" },
    };
    const result = properties(element);

    expect(result.id).toBeUndefined();
    expect(result.type).toBeUndefined();
    expect(result.variant.defaultSelected).toBe(true);
    expect(result["layout.position"].defaultSelected).toBe(true);
    expect(result["layout.left"].defaultSelected).toBe(true);
    expect(result.hidden.defaultSelected).toBe(false);
    expect(result.content.defaultSelected).toBe(false);
    expect(result["typography.fontSize"]).toBeUndefined();
  });

  it("keeps image source data selectable and initially unchecked", () => {
    const result = properties({
      type: "image",
      id: "logo",
      hidden: false,
      src: "https://example.com/logo.svg",
      alt: "Logo",
      fit: "contain",
    });

    expect(result.src.defaultSelected).toBe(false);
    expect(result.alt.defaultSelected).toBe(false);
    expect(result.fit.defaultSelected).toBe(true);
  });

  it("keeps canonical Text Stroke atomic for the real smoke-test typography", () => {
    const result = properties({
      type: "text",
      id: "smoke-test-title",
      hidden: false,
      content: "Hello Title",
      variant: "body",
      typography: {
        fontFamily: "Montserrat",
        fontSize: "48px",
        fontWeight: 900,
        textAlign: "center",
        textTransform: "uppercase",
        textStroke: { width: 2, color: "#000000" },
      },
    });

    expect(result["typography.textStroke"]?.kind).toBe("atomic-object");
    expect(result["typography.textStroke"]?.defaultSelected).toBe(true);
    expect(result["typography.textStroke.width"]).toBeUndefined();
    expect(result["typography.textStroke.color"]).toBeUndefined();
    for (const path of [
      "typography.fontFamily",
      "typography.fontSize",
      "typography.fontWeight",
      "typography.textAlign",
      "typography.textTransform",
    ]) {
      expect(result[path]).toBeDefined();
    }
  });

  it("collapses atomic objects without exposing their descendants", () => {
    const element: PowerShowElement = {
      type: "image",
      id: "image",
      hidden: false,
      src: "image.png",
      alt: "",
      fit: "cover",
      focalPoint: { x: 50, y: 50 },
      crop: { x: 10, y: 10, width: 50, height: 50 },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
      effect: { shadow: { x: 0, y: 2, blur: 4, color: "#000000" } },
    };
    const before = JSON.stringify(element);
    const result = properties(element);

    expect(result.link.kind).toBe("atomic-object");
    expect(result.link.defaultSelected).toBe(false);
    expect(result["link.url"]).toBeUndefined();
    expect(result.crop.kind).toBe("atomic-object");
    expect(result.focalPoint.kind).toBe("atomic-object");
    expect(result["effect.shadow"].kind).toBe("atomic-object");
    expect(result.link.displayValue).toBe("https://example.com · _blank");
    expect(result.crop.displayValue).toBe("x 10%, y 10%, 50% × 50%");
    expect(result.focalPoint.displayValue).toBe("x 50%, y 50%");
    expect(result["effect.shadow"].displayValue).toBe("0 2 4 · #000000");
    expect(result.link.displayValue).not.toContain("{\"kind\"");
    expect(JSON.stringify(element)).toBe(before);
  });

  it("summarizes gradients and patterns without serializing their payloads", () => {
    const result = properties({
      type: "container",
      id: "container",
      hidden: false,
      style: {
        background: {
          gradient: {
            type: "linear",
            angle: 45,
            stops: [
              { color: "#000000", position: 0 },
              { color: "#ffffff", position: 100 },
            ],
          },
          pattern: {
            image: "linear-gradient(#000 1px, transparent 1px)",
            repeat: "repeat-x",
          },
        },
      },
      children: [],
    });

    expect(result["style.background.gradient"].kind).toBe("atomic-object");
    expect(result["style.background.gradient"].displayValue).toBe("linear · 2 stops");
    expect(result["style.background.pattern"].kind).toBe("atomic-object");
    expect(result["style.background.pattern"].displayValue).toBe("pattern · repeat-x");
    expect(result["style.background.gradient"].displayValue).not.toContain("\"stops\"");
  });

  it("excludes descendant elements but keeps container layout children fields", () => {
    const element: PowerShowElement = {
      type: "container",
      id: "container",
      hidden: false,
      layout: {
        children: { direction: "column", gap: "12px", horizontalAlign: "center" },
      },
      children: [],
    };
    const result = properties(element);

    expect(result.children).toBeUndefined();
    expect(result["layout.children.direction"]).toBeDefined();
    expect(result["layout.children.gap"].defaultSelected).toBe(true);
    expect(result["layout.children.horizontalAlign"]).toBeDefined();
  });

  it("keeps intrinsic arrays as one unchecked payload unit", () => {
    const result = properties({
      type: "table",
      id: "table",
      hidden: false,
      mode: "simple",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "PowerShow" }],
    });

    expect(result.columns.kind).toBe("payload");
    expect(result.columns.defaultSelected).toBe(false);
    expect(result.rows.kind).toBe("payload");
    expect(result["rows.0"]).toBeUndefined();
  });

  it("does not mutate the selected element", () => {
    const element = {
      type: "topics",
      id: "topics",
      hidden: false,
      kind: "unordered",
      items: [],
    } satisfies PowerShowElement;
    const before = JSON.stringify(element);

    getSelectableElementProperties(element);

    expect(JSON.stringify(element)).toBe(before);
  });
});
