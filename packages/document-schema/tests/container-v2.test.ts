import { describe, expect, it } from "vitest";

import { PowerShowElementSchema } from "../src/elements";
import {
  V2ContainerBackgroundSchema,
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
    overflow: "auto" as const,
    position: "absolute" as const,
    top: 10,
    left: 20,
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
  },
  typography: {
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
  it("accepts semantic layout, visual, typography, effect, link, and child addresses", () => {
    const parsed = V2ContainerSchema.parse(candidateFixture);

    expect(parsed.layout?.width).toBe("78%");
    expect(parsed.layout?.overflow).toBe("auto");
    expect(parsed.layout?.position).toBe("absolute");
    expect(parsed.layout?.top).toBe(10);
    expect(parsed.layout?.left).toBe(20);
    expect(parsed.layout?.children?.mode).toBe("flow");
    expect(parsed.style?.background?.gradient?.type).toBe("linear");
    expect(parsed.style?.background?.pattern?.opacity).toBe(0.8);
    expect(parsed.style?.border?.width).toBe(2);
    expect(parsed.typography?.fontSize).toBe(20);
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

  it("has no placement/anchor/offset/inset/context namespace in V2", () => {
    const fixture = V2ContainerSchema.parse({
      id: "container-1",
      type: "container",
      children: [],
    });

    expect(Object.hasOwn(fixture, "placement")).toBe(false);
    expect(Object.hasOwn(fixture, "behavior")).toBe(false);
    expect(Object.hasOwn(fixture, "contentProperties")).toBe(false);
    expect(Object.hasOwn(fixture, "self")).toBe(false);
  });

  it("rejects placement, anchor, offsetX, offsetY, and inset addresses", () => {
    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        placement: { mode: "absolute", anchor: "center" },
      }).success,
    ).toBe(false);

    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        layout: {
          ...candidateFixture.layout,
          placement: { mode: "absolute", anchor: "top-left" },
        },
      }).success,
    ).toBe(false);

    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        layout: {
          ...candidateFixture.layout,
          anchor: "center",
          offsetX: "-4px",
          offsetY: 12,
        },
      }).success,
    ).toBe(false);

    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        layout: {
          ...candidateFixture.layout,
          inset: "0",
        },
      }).success,
    ).toBe(false);
  });

  it("supports only authored absolute and static-like absence, never relative/static", () => {
    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        layout: {
          ...candidateFixture.layout,
          position: "relative",
          top: 10,
        },
      }).success,
    ).toBe(false);

    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        layout: {
          ...candidateFixture.layout,
          position: "static",
          top: 10,
        },
      }).success,
    ).toBe(false);
  });

  it("accepts every absolute edge combination without drifting into a placement model", () => {
    const edges: Record<string, number>[] = [
      { top: 10 },
      { top: 10, left: 20 },
      { top: 10, right: 20 },
      { bottom: 10, left: 20 },
      { top: 10, right: 20, left: 20 },
      { top: 10, right: 20, bottom: 20, left: 30 },
    ];

    for (const edge of edges) {
      expect(
        V2ContainerSchema.safeParse({
          id: `pos-${JSON.stringify(edge)}`,
          type: "container",
          children: [],
          layout: { position: "absolute", ...edge },
        }).success,
      ).toBe(true);
    }
  });

  it("rejects authored edge offsets without absolute positioning", () => {
    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        layout: {
          ...candidateFixture.layout,
          position: undefined,
          top: 20,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects legacy addresses and style-owned namespace leakage", () => {
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

    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        layout: {
          ...candidateFixture.layout,
          verticalAlign: "center",
        },
      }).success,
    ).toBe(false);

    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        style: {
          ...candidateFixture.style,
          overflow: "hidden",
        },
      }).success,
    ).toBe(false);
  });

  it("keeps minimal and partially specified candidates free of namespace boilerplate", () => {
    expect(
      V2ContainerSchema.parse({
        id: "container-1",
        type: "container",
        children: [],
      }),
    ).toEqual({
      id: "container-1",
      type: "container",
      hidden: false,
      children: [],
    });

    expect(
      V2ContainerSchema.parse({
        id: "container-2",
        type: "container",
        layout: { width: "80%" },
        children: [],
      }),
    ).toEqual({
      id: "container-2",
      type: "container",
      hidden: false,
      layout: { width: "80%" },
      children: [],
    });
  });

  it("does not materialize layout.children defaults merely because they are effective", () => {
    const parsed = V2ContainerSchema.parse({
      id: "container-3",
      type: "container",
      children: [],
    });

    expect(parsed.layout).toBeUndefined();
  });

  it("validates and normalizes candidate background colors with ColorSchema", () => {
    expect(V2ContainerBackgroundSchema.parse({ color: "#ABCDEF" }).color).toBe(
      "#abcdef",
    );
    expect(
      V2ContainerBackgroundSchema.parse({
        color: "rgba(15, 23, 42, 0.5)",
      }).color,
    ).toBe("rgba(15, 23, 42, 0.5)");

    for (const color of ["red", "var(--surface)", "not-a-color"]) {
      expect(V2ContainerBackgroundSchema.safeParse({ color }).success).toBe(false);
    }
  });

  it("rejects a legacy Container child while retaining legacy non-Container children", () => {
    const legacyContainer = PowerShowElementSchema.parse({
      id: "legacy-container",
      type: "container",
      hidden: false,
      direction: "column",
      children: [],
    });

    const legacyText = PowerShowElementSchema.parse({
      id: "legacy-text",
      type: "text",
      hidden: false,
      variant: "body",
      content: "Legacy text",
    });

    expect(
      V2ContainerSchema.safeParse({
        id: "candidate-parent",
        type: "container",
        children: [legacyContainer],
      }).success,
    ).toBe(false);
    expect(
      V2ContainerSchema.safeParse({
        id: "candidate-parent",
        type: "container",
        children: [legacyText],
      }).success,
    ).toBe(true);
  });

  it("keeps typography and overflow out of style", () => {
    expect(candidateFixture.style).not.toHaveProperty("textAlign");
    expect(candidateFixture.style).not.toHaveProperty("overflow");
    expect(candidateFixture.typography).toHaveProperty("textAlign");
    expect(candidateFixture.layout).toHaveProperty("overflow");
  });

  it("rejects effect namespace address style.shadow and style.opacity", () => {
    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        style: { ...candidateFixture.style, shadow: {} },
      }).success,
    ).toBe(false);

    expect(
      V2ContainerSchema.safeParse({
        ...candidateFixture,
        style: { ...candidateFixture.style, opacity: 0.5 },
      }).success,
    ).toBe(false);
  });

  it("does not make the candidate a normal PowerShowElement", () => {
    expect(PowerShowElementSchema.safeParse(candidateFixture).success).toBe(false);
  });
});