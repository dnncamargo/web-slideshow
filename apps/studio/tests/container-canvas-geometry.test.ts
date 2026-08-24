import { describe, expect, it } from "vitest";

import type { ContainerElement } from "@powershow/document-schema";
import {
  getContainerCanvasResizeDirections,
  isContainerCanvasDraggable,
  updateContainerForCanvasDrag,
  updateContainerForCanvasResize,
  type ContainerCanvasDragGeometry,
  type ContainerCanvasResizeGeometry,
} from "../src/features/editor/container-canvas-geometry";

const geometry: ContainerCanvasDragGeometry = {
  parentWidthPx: 400,
  parentHeightPx: 300,
  initialLeftPx: 80,
  initialTopPx: 60,
  initialRightPx: 120,
  initialBottomPx: 90,
};

const resizeGeometry: ContainerCanvasResizeGeometry = {
  parentWidthPx: 400,
  parentHeightPx: 300,
  initialWidthPx: 200,
  initialHeightPx: 150,
  initialLeftPx: 80,
  initialTopPx: 60,
  initialRightPx: 120,
  initialBottomPx: 90,
};

function container(
  layout: ContainerElement["layout"],
): ContainerElement {
  return {
    type: "container",
    id: "container-1",
    hidden: false,
    layout,
    children: [],
  };
}

describe("canonical container canvas drag", () => {
  it("flow container is not draggable", () => {
    expect(
      isContainerCanvasDraggable(
        container({
          width: "70%",
          children: { direction: "column", mode: "flow" },
        }),
      ),
    ).toBe(false);
  });

  it("absolute container is draggable", () => {
    expect(
      isContainerCanvasDraggable(
        container({
          position: "absolute",
          top: 0,
          left: 0,
          children: { direction: "row" },
        }),
      ),
    ).toBe(true);
  });

  it("returns the same object when layout is not absolute", () => {
    const flow = container({
      width: "70%",
      children: { direction: "row" },
    });
    const updated = updateContainerForCanvasDrag(flow, 40, 30, geometry);

    expect(updated).toBe(flow);
  });

  it("returns the same object and authors no edge for zero delta", () => {
    const absolute = container({
      position: "absolute",
      top: 10,
      left: 20,
      children: { direction: "row" },
    });
    const updated = updateContainerForCanvasDrag(absolute, 0, 0, geometry);

    expect(updated).toBe(absolute);
  });

  it("drags numeric left and top", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      top: 30,
      children: { direction: "row" },
    });

    expect(updateContainerForCanvasDrag(absolute, 30, -10, geometry)).toEqual({
      ...absolute,
      layout: {
        ...absolute.layout,
        left: 50,
        top: 20,
      },
    });
  });

  it("drags right and bottom with inverse delta", () => {
    const absolute = container({
      position: "absolute",
      right: 20,
      bottom: 10,
      children: { direction: "row" },
    });

    expect(updateContainerForCanvasDrag(absolute, 30, 5, geometry)).toEqual({
      ...absolute,
      layout: {
        ...absolute.layout,
        right: -10,
        bottom: 5,
      },
    });
  });

  it("preserves dual horizontal constraints without materializing width", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      right: 30,
      top: 40,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasDrag(absolute, 10, 0, geometry);

    expect(updated.layout).toMatchObject({
      left: 30,
      right: 20,
      top: 40,
    });
    expect(updated.layout).not.toHaveProperty("width");
  });

  it("preserves dual vertical constraints without materializing height", () => {
    const absolute = container({
      position: "absolute",
      top: 20,
      bottom: 30,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasDrag(absolute, 0, 10, geometry);

    expect(updated.layout).toMatchObject({
      top: 30,
      bottom: 20,
    });
    expect(updated.layout).not.toHaveProperty("height");
  });

  it("materializes left from initial geometry when no horizontal edge exists", () => {
    const absolute = container({
      position: "absolute",
      top: 40,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasDrag(absolute, 20, 0, geometry);

    expect(updated.layout).toMatchObject({
      left: 100,
      top: 40,
    });
  });

  it("materializes top from initial geometry when no vertical edge exists", () => {
    const absolute = container({
      position: "absolute",
      left: 40,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasDrag(absolute, 0, -15, geometry);

    expect(updated.layout).toMatchObject({
      top: 45,
      left: 40,
    });
  });

  it("materializes no edge for an axis with zero movement", () => {
    const absolute = container({
      position: "absolute",
      top: 40,
      children: { direction: "row" },
    });

    const moved = updateContainerForCanvasDrag(absolute, 20, 0, geometry);

    expect(moved.layout).toMatchObject({ left: 100, top: 40 });
    expect(moved.layout).not.toHaveProperty("right");
    expect(moved.layout).not.toHaveProperty("bottom");
    expect(moved.layout).not.toHaveProperty("width");
    expect(moved.layout).not.toHaveProperty("height");
  });

  it("resolves a px-string edge to numeric px", () => {
    const absolute = container({
      position: "absolute",
      left: "20px",
      children: { direction: "row" },
    });

    expect(updateContainerForCanvasDrag(absolute, 30, 0, geometry)).toEqual({
      ...absolute,
      layout: {
        ...absolute.layout,
        left: 50,
      },
    });
  });

  it("resolves a percentage edge against the direct parent logical dimension", () => {
    const absolute = container({
      position: "absolute",
      left: "10%",
      children: { direction: "row" },
    });

    expect(updateContainerForCanvasDrag(absolute, 20, 0, geometry)).toEqual({
      ...absolute,
      layout: {
        ...absolute.layout,
        left: 60,
      },
    });
  });

  it("falls back to initial rendered edge distance for an unresolvable Length string", () => {
    const absolute = container({
      position: "absolute",
      left: "calc(10% + 4px)",
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasDrag(absolute, 20, 0, geometry);

    expect(updated.layout).toMatchObject({
      left: 100,
    });
  });

  it("preserves unrelated layout properties", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      top: 40,
      width: "80%",
      height: 200,
      padding: 16,
      overflow: "auto",
      children: {
        direction: "column",
        mode: "stack",
        gap: 8,
        distribution: "space-between",
      },
    });

    const updated = updateContainerForCanvasDrag(absolute, 10, 5, geometry);

    expect(updated.layout).toMatchObject({
      left: 30,
      top: 45,
      width: "80%",
      height: 200,
      padding: 16,
      overflow: "auto",
      children: {
        direction: "column",
        mode: "stack",
        gap: 8,
        distribution: "space-between",
      },
    });
  });

  it("preserves layout.children and container capabilities", () => {
    const content = {
      type: "text" as const,
      id: "text-1",
      content: "hello",
      variant: "body" as const,
      hidden: false,
      layout: { position: "absolute" as const, left: 5 },
    };
    const absolute = container({
      position: "absolute",
      top: 10,
      left: 20,
      children: { direction: "row", gap: 8 },
    });
    const withContent: ContainerElement = {
      ...absolute,
      role: "main",
      style: {
        color: "#ffffff",
        background: { color: "#000000" },
        borderRadius: 4,
      },
      typography: { fontWeight: 600, fontSize: 18 },
      effect: { opacity: 0.8 },
      link: { kind: "url", href: "https://example.com" },
      children: [content],
    };

    const updated = updateContainerForCanvasDrag(withContent, 30, -10, geometry);

    expect(updated.layout).toMatchObject({
      left: 50,
      top: 0,
      children: { direction: "row", gap: 8 },
    });
    expect(updated).toMatchObject({
      id: "container-1",
      type: "container",
      role: "main",
      style: withContent.style,
      typography: withContent.typography,
      effect: withContent.effect,
      link: withContent.link,
      hidden: false,
    });
    expect(updated.children).toEqual([content]);
  });

  it("does not introduce legacy placement or absolute offsets", () => {
    const absolute = container({
      position: "absolute",
      top: 10,
      left: 20,
      children: { direction: "row" },
    });

    const result = updateContainerForCanvasDrag(absolute, 10, 5, geometry);

    expect(result.layout).not.toHaveProperty("placement");
    expect(result.layout).not.toHaveProperty("anchor");
    expect(result.layout).not.toHaveProperty("offsetX");
    expect(result.layout).not.toHaveProperty("offsetY");
    expect(result).not.toHaveProperty("style.position");
    expect(result).not.toHaveProperty("style.top");
    expect(result).not.toHaveProperty("style.right");
    expect(result).not.toHaveProperty("style.bottom");
    expect(result).not.toHaveProperty("style.left");
    expect(result).not.toHaveProperty("placement");
  });
});

describe("canonical container canvas resize handle policy", () => {
  it("exposes only E/S/SE for a flow container", () => {
    const flow = container({
      width: "70%",
      children: { direction: "column", mode: "flow" },
    });

    expect(getContainerCanvasResizeDirections(flow)).toEqual([
      "e",
      "s",
      "se",
    ]);
  });

  it("exposes all eight directions for an absolute container", () => {
    const absolute = container({
      position: "absolute",
      top: 0,
      left: 0,
      children: { direction: "row" },
    });

    expect(getContainerCanvasResizeDirections(absolute)).toEqual([
      "n",
      "ne",
      "e",
      "se",
      "s",
      "sw",
      "w",
      "nw",
    ]);
  });
});

describe("canonical container canvas resize identity and safety", () => {
  it("returns the same object for zero delta", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      top: 30,
      children: { direction: "row" },
    });

    expect(
      updateContainerForCanvasResize(absolute, "e", 0, 0, resizeGeometry),
    ).toBe(absolute);
  });

  it("returns the same object for an unsupported flow direction", () => {
    const flow = container({
      width: "70%",
      children: { direction: "row" },
    });

    expect(
      updateContainerForCanvasResize(flow, "n", 40, 0, resizeGeometry),
    ).toBe(flow);
    expect(
      updateContainerForCanvasResize(flow, "w", 40, 0, resizeGeometry),
    ).toBe(flow);
    expect(
      updateContainerForCanvasResize(flow, "ne", 40, 40, resizeGeometry),
    ).toBe(flow);
  });
});

describe("canonical flow container resize", () => {
  it("E writes width only", () => {
    const flow = container({
      width: "70%",
      children: { direction: "column", mode: "flow" },
    });

    const updated = updateContainerForCanvasResize(
      flow,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toEqual({
      width: "60%",
      children: { direction: "column", mode: "flow" },
    });
  });

  it("S writes height only", () => {
    const flow = container({
      width: "70%",
      children: { direction: "column", mode: "flow" },
    });

    const updated = updateContainerForCanvasResize(
      flow,
      "s",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      width: "70%",
      height: "53.3333%",
      children: { direction: "column", mode: "flow" },
    });
  });

  it("SE writes both width and height", () => {
    const flow = container({
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      flow,
      "se",
      40,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      width: "60%",
      height: "53.3333%",
      children: { direction: "row" },
    });
  });

  it("serializes dimensions as percentages against the parent reference", () => {
    const flow = container({
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      flow,
      "e",
      20,
      0,
      resizeGeometry,
    );

    expect(updated.layout?.width).toBe("55%");
  });

  it("never authors position or edges for flow resize", () => {
    const flow = container({
      width: "70%",
      height: 120,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      flow,
      "se",
      40,
      10,
      resizeGeometry,
    );

    expect(updated.layout).not.toHaveProperty("position");
    expect(updated.layout).not.toHaveProperty("top");
    expect(updated.layout).not.toHaveProperty("right");
    expect(updated.layout).not.toHaveProperty("bottom");
    expect(updated.layout).not.toHaveProperty("left");
  });
});

describe("absolute container stretch resize", () => {
  it("left+right no width, W updates left only", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      right: 30,
      top: 0,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 60,
      right: 30,
      top: 0,
    });
    expect(updated.layout).not.toHaveProperty("width");
  });

  it("left+right no width, E updates right only", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      right: 30,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 20,
      right: -10,
    });
    expect(updated.layout).not.toHaveProperty("width");
  });

  it("top+bottom no height, N updates top only", () => {
    const absolute = container({
      position: "absolute",
      top: 20,
      bottom: 30,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "n",
      0,
      40,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      top: 60,
      bottom: 30,
    });
    expect(updated.layout).not.toHaveProperty("height");
  });

  it("top+bottom no height, S updates bottom only", () => {
    const absolute = container({
      position: "absolute",
      top: 20,
      bottom: 30,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "s",
      0,
      40,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      top: 20,
      bottom: -10,
    });
    expect(updated.layout).not.toHaveProperty("height");
  });
});

describe("absolute container explicit size resize", () => {
  it("left+width, E updates width only", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      width: 200,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 20,
      width: "60%",
    });
  });

  it("left+width, W updates left and width", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      width: 200,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 60,
      width: "40%",
    });
  });

  it("right+width, W updates width only", () => {
    const absolute = container({
      position: "absolute",
      right: 20,
      width: 200,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      right: 20,
      width: "40%",
    });
  });

  it("right+width, E updates right and width", () => {
    const absolute = container({
      position: "absolute",
      right: 20,
      width: 200,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      right: -20,
      width: "60%",
    });
  });

  it("top+height, S updates height only", () => {
    const absolute = container({
      position: "absolute",
      top: 20,
      height: 150,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "s",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      top: 20,
      height: "53.3333%",
    });
  });

  it("top+height, N updates top and height", () => {
    const absolute = container({
      position: "absolute",
      top: 20,
      height: 150,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "n",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      top: 30,
      height: "46.6667%",
    });
  });

  it("bottom+height, N updates height only", () => {
    const absolute = container({
      position: "absolute",
      bottom: 20,
      height: 150,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "n",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      bottom: 20,
      height: "46.6667%",
    });
  });

  it("bottom+height, S updates bottom and height", () => {
    const absolute = container({
      position: "absolute",
      bottom: 20,
      height: 150,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "s",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      bottom: 10,
      height: "53.3333%",
    });
  });
});

describe("absolute container resize materialization", () => {
  it("left only/no width, E materializes width", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 20,
      width: "60%",
    });
  });

  it("left only/no width, W updates left and materializes width", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 60,
      width: "40%",
    });
  });

  it("right only/no width, W materializes width", () => {
    const absolute = container({
      position: "absolute",
      right: 20,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      right: 20,
      width: "40%",
    });
  });

  it("right only/no width, E updates right and materializes width", () => {
    const absolute = container({
      position: "absolute",
      right: 20,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      right: -20,
      width: "60%",
    });
  });

  it("top only/no height, S materializes height", () => {
    const absolute = container({
      position: "absolute",
      top: 20,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "s",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      top: 20,
      height: "53.3333%",
    });
  });

  it("top only/no height, N updates top and materializes height", () => {
    const absolute = container({
      position: "absolute",
      top: 20,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "n",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      top: 30,
      height: "46.6667%",
    });
  });

  it("bottom only/no height, N materializes height", () => {
    const absolute = container({
      position: "absolute",
      bottom: 20,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "n",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      bottom: 20,
      height: "46.6667%",
    });
  });

  it("bottom only/no height, S updates bottom and materializes height", () => {
    const absolute = container({
      position: "absolute",
      bottom: 20,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "s",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      bottom: 10,
      height: "53.3333%",
    });
  });

  it("no horizontal edges materializes left and width", () => {
    const absolute = container({
      position: "absolute",
      top: 40,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 80,
      top: 40,
      width: "60%",
    });
  });

  it("no horizontal edges + W materializes left from rendered offset", () => {
    const absolute = container({
      position: "absolute",
      top: 40,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 120,
      top: 40,
      width: "40%",
    });
  });

  it("no vertical edges materializes top and height", () => {
    const absolute = container({
      position: "absolute",
      left: 40,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "s",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 40,
      top: 60,
      height: "53.3333%",
    });
  });

  it("no vertical edges + N materializes top from rendered offset", () => {
    const absolute = container({
      position: "absolute",
      left: 40,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "n",
      0,
      10,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 40,
      top: 70,
      height: "46.6667%",
    });
  });
});

describe("container resize units and edge policy", () => {
  it("resolves a touched percentage edge to numeric px", () => {
    const absolute = container({
      position: "absolute",
      left: "10%",
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      20,
      0,
      resizeGeometry,
    );

    // left resolves to 10% of 400 = 40, then +20 => 60
    expect(updated.layout).toMatchObject({
      left: 60,
      width: "45%",
    });
  });

  it("resolves a px-string edge to numeric px", () => {
    const absolute = container({
      position: "absolute",
      left: "20px",
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      10,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 30,
    });
  });

  it("uses the rendered edge fallback for an unresolvable Length", () => {
    const absolute = container({
      position: "absolute",
      left: "calc(10% + 4px)",
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      10,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 90,
    });
  });

  it("serializes a touched width/height as percentage against the parent", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      width: "50%",
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "e",
      20,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      width: "55%",
    });
  });
});

describe("container resize clamp", () => {
  it("clamps an explicit dimension at 1 logical px", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      width: 200,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "w",
      260,
      0,
      resizeGeometry,
    );

    // 200 - 260 => clamped to 1, serialized against 400 => 0.25%
    expect(updated.layout).toMatchObject({
      width: "0.25%",
    });
  });
});

describe("container resize preservation and canonical contract", () => {
  it("preserves unrelated layout, children, style, typography, effect, link", () => {
    const content = {
      type: "text" as const,
      id: "text-1",
      content: "hello",
      variant: "body" as const,
      hidden: false,
    };
    const absolute = container({
      position: "absolute",
      left: 20,
      top: 40,
      width: "80%",
      height: 200,
      padding: 16,
      overflow: "auto",
      children: { direction: "column", mode: "stack", gap: 8 },
    });
    const withContent: ContainerElement = {
      ...absolute,
      role: "main",
      style: {
        color: "#ffffff",
        background: { color: "#000000" },
        borderRadius: 4,
      },
      typography: { fontWeight: 600, fontSize: 18 },
      effect: { opacity: 0.8 },
      link: { kind: "url", href: "https://example.com" },
      children: [content],
    };

    const updated = updateContainerForCanvasResize(
      withContent,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 20,
      top: 40,
      height: 200,
      padding: 16,
      overflow: "auto",
      children: { direction: "column", mode: "stack", gap: 8 },
    });
    expect(updated).toMatchObject({
      id: "container-1",
      type: "container",
      role: "main",
      style: withContent.style,
      typography: withContent.typography,
      effect: withContent.effect,
      link: withContent.link,
      hidden: false,
    });
    expect(updated.children).toEqual([content]);
  });

  it("never writes style width/height or legacy placement", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      top: 40,
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "se",
      40,
      10,
      resizeGeometry,
    );

    expect(updated).not.toHaveProperty("style");
    expect(updated.layout).not.toHaveProperty("placement");
    expect(updated.layout).not.toHaveProperty("anchor");
    expect(updated.layout).not.toHaveProperty("offsetX");
    expect(updated.layout).not.toHaveProperty("offsetY");
    expect(updated).not.toHaveProperty("placement");
  });

  it("preserves authored co-both-edge + width presence without removing fields", () => {
    const absolute = container({
      position: "absolute",
      left: 20,
      right: 30,
      width: "50%",
      children: { direction: "row" },
    });

    const updated = updateContainerForCanvasResize(
      absolute,
      "e",
      40,
      0,
      resizeGeometry,
    );

    expect(updated.layout).toMatchObject({
      left: 20,
      right: -10,
      width: "60%",
    });
  });
});
