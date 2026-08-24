import { describe, expect, it } from "vitest";

import type { ContainerElement } from "@powershow/document-schema";
import {
  isContainerCanvasDraggable,
  updateContainerForCanvasDrag,
  type ContainerCanvasDragGeometry,
} from "../src/features/editor/container-canvas-geometry";

const geometry: ContainerCanvasDragGeometry = {
  parentWidthPx: 400,
  parentHeightPx: 300,
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
      style: { placement: { mode: "absolute" as const, offsetX: 5 } },
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
