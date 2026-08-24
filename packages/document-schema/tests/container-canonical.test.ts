import { describe, expect, it } from "vitest";

import {
  PowerShowElementSchema,
} from "../src/elements";
import { PresentationSchema } from "../src/presentation";

const minimalContainer = {
  id: "container-1",
  type: "container" as const,
  children: [],
};

describe("production canonical Container schema", () => {
  it("parses a minimal Container without materializing optional namespaces", () => {
    expect(PowerShowElementSchema.parse(minimalContainer)).toEqual({
      ...minimalContainer,
      hidden: false,
    });
  });

  it("parses recursive and fully composed canonical Containers", () => {
    const result = PowerShowElementSchema.safeParse({
      ...minimalContainer,
      role: "main",
      layout: {
        width: "100%",
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: "hidden",
        children: {
          mode: "stack",
          direction: "row",
          gap: 16,
          distribution: "space-between",
          horizontalAlign: "center",
          verticalAlign: "end",
        },
      },
      style: {
        color: "#ffffff",
        background: {
          color: "#111111",
          gradient: {
            type: "linear",
            stops: [
              { color: "#000000", position: 0 },
              { color: "#ffffff", position: 100 },
            ],
          },
          pattern: {
            image: "linear-gradient(#444 1px, transparent 1px)",
          },
        },
        border: { width: 1, style: "solid", color: "#ffffff" },
        borderRadius: 8,
        className: "hero",
      },
      typography: {
        fontFamily: "Inter",
        fontSize: 24,
        fontWeight: 700,
        fontStyle: "normal",
        textAlign: "center",
        lineHeight: 1.2,
        letterSpacing: 1,
        textTransform: "uppercase",
        whiteSpace: "normal",
        textWrapStyle: "pretty",
        overflowWrap: "break-word",
        textDecorationLine: "underline",
        textDecorationColor: "#ffffff",
        textStroke: { width: 1, color: "#000000" },
      },
      effect: {
        opacity: 0.8,
        shadow: { x: 0, y: 2, blur: 8, color: "#000000" },
      },
      link: {
        kind: "url",
        href: "https://example.com",
        target: "_blank",
      },
      children: [
        {
          id: "nested-container",
          type: "container",
          layout: { children: { direction: "column" } },
          children: [],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires absolute positioning for every authored edge", () => {
    for (const edge of ["top", "right", "bottom", "left"] as const) {
      expect(
        PowerShowElementSchema.safeParse({
          ...minimalContainer,
          layout: { [edge]: 0 },
        }).success,
      ).toBe(false);
    }

    expect(
      PowerShowElementSchema.safeParse({
        ...minimalContainer,
        layout: { position: "relative" },
      }).success,
    ).toBe(false);
    expect(
      PowerShowElementSchema.safeParse({
        ...minimalContainer,
        layout: { position: "static" },
      }).success,
    ).toBe(false);

    expect(
      PowerShowElementSchema.safeParse({
        ...minimalContainer,
        layout: { position: "absolute", left: 0, right: 0 },
      }).success,
    ).toBe(true);
  });

  it("accepts canonical non-Container children", () => {
    expect(
      PowerShowElementSchema.safeParse({
        ...minimalContainer,
        children: [{
          id: "child-text",
          type: "text",
          content: "Child",
        }],
      }).success,
    ).toBe(true);
  });

  it("rejects old Container top-level and style responsibilities", () => {
    for (const field of [
      "direction",
      "layoutMode",
      "distribution",
      "gap",
      "horizontalAlign",
      "verticalAlign",
      "width",
    ]) {
      expect(
        PowerShowElementSchema.safeParse({
          ...minimalContainer,
          [field]: field === "width" ? 100 : "row",
        }).success,
      ).toBe(false);
    }

    for (const field of [
      "width",
      "height",
      "padding",
      "overflow",
      "backgroundGradient",
      "backgroundPattern",
      "opacity",
      "shadow",
      "position",
      "placement",
      "top",
      "right",
      "bottom",
      "left",
    ]) {
      expect(
        PowerShowElementSchema.safeParse({
          ...minimalContainer,
          style: {
            [field]: field === "opacity"
              ? 0.5
              : field === "position"
                ? "absolute"
                : field === "placement"
                  ? { mode: "absolute" }
                  : 10,
          },
        }).success,
      ).toBe(false);
    }

    expect(
      PowerShowElementSchema.safeParse({
        ...minimalContainer,
        style: { background: "#111111" },
      }).success,
    ).toBe(false);

    expect(
      PowerShowElementSchema.safeParse({
        ...minimalContainer,
        style: { fontSize: 24, fontFamily: "Inter" },
      }).success,
    ).toBe(false);
  });

  it("accepts canonical Containers in presentations and rejects old shapes", () => {
    const presentation = {
      schemaVersion: 1,
      id: "presentation-1",
      title: "Canonical Containers",
      slides: [{ id: "slide-1", elements: [minimalContainer] }],
    };

    expect(PresentationSchema.safeParse(presentation).success).toBe(true);
    expect(
      PresentationSchema.safeParse({
        ...presentation,
        slides: [{
          id: "slide-1",
          elements: [{ ...minimalContainer, direction: "row" }],
        }],
      }).success,
    ).toBe(false);
  });
});
