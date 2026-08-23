import { describe, expect, it } from "vitest";

import { PowerShowElementSchema } from "../src/elements";
import {
  CandidateContainerSchema,
  ContainerLayoutSchema,
  isCandidateContainerElement,
} from "../src";

const gradient = {
  type: "linear" as const,
  stops: [
    { color: "#000000", position: 0 },
    { color: "#ffffff", position: 100 },
  ],
};

const minimal = {
  id: "container-1",
  type: "container" as const,
  children: [],
};

describe("CandidateContainerSchema", () => {
  it("parses a minimal candidate without optional namespaces", () => {
    expect(CandidateContainerSchema.parse(minimal)).toEqual({
      ...minimal,
      hidden: false,
    });
  });

  it("composes canonical layout, style, typography, effect, and link", () => {
    const parsed = CandidateContainerSchema.parse({
      ...minimal,
      layout: {
        width: "80%",
        overflow: "auto",
        position: "absolute",
        top: 10,
        left: 20,
        children: { direction: "row", gap: 16 },
      },
      style: {
        color: "#ffffff",
        background: { color: "#111827", gradient },
        border: { width: 2, color: "#334155" },
        borderRadius: 8,
        className: "surface",
      },
      typography: { textAlign: "center", fontSize: 20 },
      effect: {
        opacity: 0.8,
        shadow: { x: 0, y: 4, blur: 12, color: "#000000" },
      },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    });

    expect(parsed.layout?.children?.gap).toBe(16);
    expect(parsed.style?.background?.gradient).toEqual(gradient);
    expect(parsed.typography?.textAlign).toBe("center");
    expect(parsed.effect?.opacity).toBe(0.8);
    expect(parsed.link?.target).toBe("_blank");
  });

  it("recurses through candidate Containers", () => {
    const parsed = CandidateContainerSchema.parse({
      ...minimal,
      children: [
        {
          ...minimal,
          id: "nested",
          children: [{ ...minimal, id: "deep" }],
        },
      ],
    });

    expect(isCandidateContainerElement(parsed.children[0]!)).toBe(true);
    expect(parsed.children[0]).toMatchObject({
      id: "nested",
      children: [{ id: "deep", hidden: false }],
    });
  });

  it("inherits canonical absolute edge validation", () => {
    expect(
      CandidateContainerSchema.safeParse({
        ...minimal,
        layout: { position: "absolute", top: 10, right: 20 },
      }).success,
    ).toBe(true);
    expect(
      CandidateContainerSchema.safeParse({
        ...minimal,
        layout: { top: 10 },
      }).success,
    ).toBe(false);
    expect(
      CandidateContainerSchema.safeParse({
        ...minimal,
        layout: { position: "relative" },
      }).success,
    ).toBe(false);
    expect(
      CandidateContainerSchema.safeParse({
        ...minimal,
        layout: { position: "static" },
      }).success,
    ).toBe(false);
    expect(ContainerLayoutSchema.safeParse({ position: "absolute" }).success).toBe(
      true,
    );
  });

  it("rejects old top-level addresses and namespace leakage", () => {
    for (const value of [
      { direction: "row" },
      { layoutMode: "stack" },
      { gap: 16 },
      { width: "80%" },
      { overflow: "hidden" },
      { typography: { opacity: 0.5 } },
      { style: { overflow: "hidden" } },
      { style: { textAlign: "center" } },
      { style: { opacity: 0.5 } },
      { style: { shadow: {} } },
      { style: { backgroundGradient: gradient } },
    ]) {
      expect(CandidateContainerSchema.safeParse({ ...minimal, ...value }).success).toBe(
        false,
      );
    }
  });

  it("accepts production non-Container children", () => {
    const text = PowerShowElementSchema.parse({
      id: "text-1",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Hello",
    });

    const parsed = CandidateContainerSchema.parse({
      ...minimal,
      children: [text],
    });

    expect(parsed.children[0]).toMatchObject({ id: "text-1", type: "text" });
  });

  it("rejects production Containers through the production-child path", () => {
    const productionContainer = PowerShowElementSchema.parse({
      id: "production-container",
      type: "container",
      hidden: false,
      direction: "column",
      children: [],
    });

    const parsed = CandidateContainerSchema.safeParse({
      ...minimal,
      children: [productionContainer],
    });

    expect(parsed.success).toBe(false);
  });

  it("keeps candidate namespaces distinct from the production Container contract", () => {
    const candidate = CandidateContainerSchema.parse({
      ...minimal,
      layout: { children: { direction: "row", gap: 8 } },
      style: { background: { color: "#111827" } },
    });

    expect(PowerShowElementSchema.safeParse(candidate).success).toBe(false);
    expect(candidate).not.toHaveProperty("direction");
    expect(candidate.layout?.children?.direction).toBe("row");
  });
});
