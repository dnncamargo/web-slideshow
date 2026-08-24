import { describe, expect, it } from "vitest";

import {
  updateContainerLayoutMode,
  updateContainerPositionEdge,
  updateContainerPositionMode,
} from "../src/features/editor/inspector/container-inspector-helpers";

describe("container layout mode updates", () => {
  it("changes only layout mode when selecting stack", () => {
    const container = {
      type: "container" as const,
      id: "container",
      hidden: false,
      layout: {
        width: "80%",
        children: {
          direction: "row" as const,
          distribution: "space-between" as const,
          horizontalAlign: "center" as const,
          verticalAlign: "end" as const,
        },
      },
      children: [],
    };

    expect(updateContainerLayoutMode(container, "stack")).toEqual({
      ...container,
      layout: {
        ...container.layout,
        children: { ...container.layout.children, mode: "stack" },
      },
    });
  });

  it("clears mode when switching back to flow and preserves child layout", () => {
    const container = {
      type: "container" as const,
      id: "container",
      hidden: false,
      layout: {
        children: {
          mode: "stack" as const,
          direction: "column" as const,
          distribution: "space-around" as const,
          horizontalAlign: "center" as const,
          verticalAlign: "center" as const,
        },
      },
      children: [],
    };

    expect(updateContainerLayoutMode(container, "flow")).toEqual({
      ...container,
      layout: {
        ...container.layout,
        children: { ...container.layout.children, mode: undefined },
      },
    });
  });
});

describe("container position updates", () => {
  const container = {
    type: "container" as const,
    id: "container",
    hidden: false,
    layout: {
      width: "80%" as const,
      height: 200,
      padding: 16,
      children: { direction: "column" as const, mode: "stack" as const },
    },
    children: [],
  };

  it("initializes top and left when entering absolute positioning", () => {
    expect(updateContainerPositionMode(container, "absolute")).toEqual({
      ...container,
      layout: { ...container.layout, position: "absolute", top: 0, left: 0 },
    });
  });

  it("clears all position edges when returning to flow", () => {
    const absolute = updateContainerPositionMode(container, "absolute");
    const positioned = updateContainerPositionEdge(absolute, "right", "10%");

    expect(updateContainerPositionMode(positioned, "flow")).toEqual({
      ...container,
      layout: container.layout,
    });
  });

  it("updates one edge without removing opposite edges", () => {
    const absolute = updateContainerPositionMode(container, "absolute");
    const withTopAndLeft = updateContainerPositionEdge(absolute, "top", 12);
    const withOppositeEdges = updateContainerPositionEdge(
      withTopAndLeft,
      "bottom",
      24,
    );

    expect(withOppositeEdges.layout).toMatchObject({
      position: "absolute",
      top: 12,
      bottom: 24,
      left: 0,
    });
  });
});
