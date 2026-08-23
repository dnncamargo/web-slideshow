import { describe, expect, it } from "vitest";

import { PowerShowElementSchema } from "../src/elements";
import {
  V2ContainerSchema,
  type V2ContainerElement,
} from "../src/container-v2";

const dotPattern = "radial-gradient(#444CF7 1.5px, transparent 1.5px)";

const gradient = {
  type: "linear" as const,
  angle: 135,
  stops: [
    { color: "#111827", position: 0 },
    { color: "#312e81", position: 100 },
  ],
};

const candidateFixture = {
  id: "candidate-content",
  type: "container" as const,
  hidden: false,
  role: "content" as const,
  layout: {
    width: "78%",
    height: "72%",
    minWidth: 240,
    minHeight: "20%",
    maxWidth: "90%",
    maxHeight: 720,
    margin: 16,
    marginTop: 8,
    marginRight: "2%",
    marginBottom: 24,
    marginLeft: 4,
    padding: 48,
    paddingTop: 32,
    paddingRight: "4%",
    paddingBottom: 40,
    paddingLeft: 24,
    placement: {
      mode: "absolute" as const,
      anchor: "center" as const,
      offsetX: "-4px",
      offsetY: 12,
    },
    children: {
      mode: "flow" as const,
      direction: "column" as const,
      gap: 24,
      distribution: "packed" as const,
      horizontalAlign: "center" as const,
      verticalAlign: "center" as const,
    },
  },
  style: {
    color: "#f8fafc",
    background: {
      color: "#0f172a",
      gradient,
      pattern: {
        image: dotPattern,
        size: "20px 20px",
        opacity: 0.8,
      },
    },
    border: {
      width: 2,
      style: "solid" as const,
      color: "#334155",
    },
    borderRadius: 24,
    className: "content-surface",
    fontFamily: "Inter",
    fontSize: 20,
    textAlign: "center" as const,
  },
  effect: {
    opacity: 0.9,
    shadow: {
      x: 0,
      y: 12,
      blur: 32,
      color: "#00000066",
    },
  },
  link: {
    kind: "url" as const,
    href: "https://example.com/content",
    target: "_blank" as const,
  },
  children: [
    {
      id: "candidate-text",
      type: "text" as const,
      hidden: false,
      variant: "body" as const,
      content: "Candidate content",
    },
  ],
};

describe("V2ContainerSchema", () => {
  it("accepts semantic layout, visual, effect, link, and child addresses", () => {
    const parsed = V2ContainerSchema.parse(candidateFixture);

    expect(parsed.layout.width).toBe("78%");
    expect(parsed.layout.children.mode).toBe("flow");
    expect(parsed.layout.placement?.mode).toBe("absolute");
    expect(parsed.style?.background?.gradient?.type).toBe("linear");
    expect(parsed.style?.background?.pattern?.opacity).toBe(0.8);
    expect(parsed.style?.border?.width).toBe(2);
    expect(parsed.effect?.shadow?.y).toBe(12);
    expect(parsed.link?.href).toBe("https://example.com/content");
    expect(parsed.children).toHaveLength(1);
  });

  it("supports recursive candidate containers without joining the production union", () => {
    const nested: V2ContainerElement = {
      ...V2ContainerSchema.parse(candidateFixture),
      id: "nested-candidate",
      layout: {
        ...V2ContainerSchema.parse(candidateFixture).layout,
        children: {
          mode: "stack",
          direction: "row",
        },
      },
      children: [],
    };

    const parsed = V2ContainerSchema.parse({
      ...candidateFixture,
      children: [nested],
    });

    expect(parsed.children[0]).toMatchObject({
      id: "nested-candidate",
      layout: { children: { mode: "stack", direction: "row" } },
    });
  });

  it("does not accept legacy addresses as candidate addresses", () => {
    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        width: "78%",
      }).success,
    ).toBe(false);

    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        style: {
          ...candidateFixture.style,
          backgroundGradient: gradient,
        },
      }).success,
    ).toBe(false);
  });

  it("does not make the candidate a normal PowerShowElement", () => {
    expect(PowerShowElementSchema.safeParse(candidateFixture).success).toBe(false);
  });
});
