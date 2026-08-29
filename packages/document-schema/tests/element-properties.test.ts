import { describe, expect, it } from "vitest";

import {
  ContainerChildrenLayoutSchema,
  ContainerLayoutSchema,
  ElementBackgroundSchema,
  ElementEffectSchema,
  ElementLayoutSchema,
  ElementTypographySchema,
  ElementVisualStyleSchema,
} from "../src/element-properties";
import { PowerShowElementSchema } from "../src/elements";

describe("canonical element property vocabulary", () => {
  it("does not materialize optional namespaces or their fields", () => {
    expect(ElementLayoutSchema.parse({})).toEqual({});
    expect(ElementVisualStyleSchema.parse({})).toEqual({});
    expect(ElementTypographySchema.parse({})).toEqual({});
    expect(ElementEffectSchema.parse({})).toEqual({});
    expect(ContainerLayoutSchema.parse({})).toEqual({});
  });

  it("accepts absolute positioning with any authored edge combination", () => {
    for (const edges of [
      { top: 10 },
      { top: 10, left: 20 },
      { top: 10, right: 20 },
      { bottom: 10, left: 20 },
      { top: 10, right: 20, bottom: 30, left: 40 },
    ]) {
      expect(
        ElementLayoutSchema.safeParse({ position: "absolute", ...edges })
          .success,
      ).toBe(true);
    }
  });

  it("requires absolute positioning for authored edges", () => {
    expect(ElementLayoutSchema.safeParse({ top: 10 }).success).toBe(false);
    expect(
      ElementLayoutSchema.safeParse({ position: "relative", top: 10 }).success,
    ).toBe(false);
    expect(
      ElementLayoutSchema.safeParse({ position: "static", top: 10 }).success,
    ).toBe(false);
  });

  it("rejects legacy placement vocabulary and unknown fields", () => {
    for (const value of [
      { placement: { mode: "absolute" } },
      { anchor: "center" },
      { offsetX: 10 },
      { offsetY: 10 },
      { inset: 0 },
    ]) {
      expect(ElementLayoutSchema.safeParse(value).success).toBe(false);
    }

    expect(
      ElementVisualStyleSchema.safeParse({ overflow: "hidden" }).success,
    ).toBe(false);
  });

  it("keeps visual, typography, and effect responsibilities separate", () => {
    expect(ElementLayoutSchema.parse({ overflow: "auto" })).toEqual({
      overflow: "auto",
    });
    expect(ElementTypographySchema.parse({ textAlign: "center" })).toEqual({
      textAlign: "center",
    });
    expect(ElementEffectSchema.parse({ opacity: 0.5 })).toEqual({
      opacity: 0.5,
    });
    expect(ElementEffectSchema.parse({ shadow: { x: 0, y: 1, blur: 2, color: "#000000" } })).toHaveProperty("shadow");

    expect(
      ElementVisualStyleSchema.safeParse({ textAlign: "center" }).success,
    ).toBe(false);
    expect(
      ElementVisualStyleSchema.safeParse({ opacity: 0.5 }).success,
    ).toBe(false);
    expect(
      ElementVisualStyleSchema.safeParse({ shadow: {} }).success,
    ).toBe(false);
  });

  it("groups background color, gradient, and pattern without imposing XOR", () => {
    const parsed = ElementBackgroundSchema.parse({
      color: "#ffffff",
      gradient: {
        type: "linear",
        stops: [
          { color: "#000000", position: 0 },
          { color: "#ffffff", position: 100 },
        ],
      },
      pattern: { image: "radial-gradient(#444 1px, transparent 1px)" },
    });

    expect(parsed.color).toBe("#ffffff");
    expect(parsed.gradient).toBeDefined();
    expect(parsed.pattern).toBeDefined();
  });

  it("puts container child organization under layout.children", () => {
    const children = ContainerChildrenLayoutSchema.parse({
      mode: "flow",
      direction: "row",
      gap: 16,
      distribution: "space-between",
      horizontalAlign: "center",
      verticalAlign: "end",
    });

    expect(children).toMatchObject({ gap: 16, horizontalAlign: "center" });
    expect(
      ContainerLayoutSchema.safeParse({
        children,
        horizontalAlign: "center",
      }).success,
    ).toBe(false);
  });

  it("accepts only literal zero for Container flex shrinking", () => {
    expect(ContainerLayoutSchema.parse({ flexShrink: 0 })).toEqual({
      flexShrink: 0,
    });
    expect(ContainerLayoutSchema.parse({}).flexShrink).toBeUndefined();

    for (const value of [1, -1, true, "0", null]) {
      expect(ContainerLayoutSchema.safeParse({ flexShrink: value }).success).toBe(false);
    }
  });

  it("allows Container flex shrinking alongside sizing, children fit, and nesting", () => {
    const parsed = ContainerLayoutSchema.parse({
      flexShrink: 0,
      width: "80%",
      height: 100,
      padding: 12,
      children: {
        mode: "flow",
        direction: "row",
        fit: { mode: "contain", sourceWidth: 800, sourceHeight: 400 },
      },
    });

    expect(parsed).toMatchObject({ flexShrink: 0, width: "80%", height: 100 });
    const nested = PowerShowElementSchema.parse({
      id: "outer",
      type: "container",
      hidden: false,
      layout: { flexShrink: 0 },
      children: [{
        id: "inner",
        type: "container",
        hidden: false,
        layout: { flexShrink: 0 },
        children: [],
      }],
    });

    expect(nested.type).toBe("container");
    if (nested.type !== "container") {
      throw new Error("Expected nested Container element");
    }
    expect(nested.children[0]).toMatchObject({
      type: "container",
      layout: { flexShrink: 0 },
    });
  });
});
