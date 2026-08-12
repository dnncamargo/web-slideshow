import { describe, expect, it } from "vitest";

import { updateContainerLayoutMode } from "../src/features/editor/inspector/container-inspector-helpers";
import { updatePlacementMode } from "../src/features/editor/inspector/sections/element-placement-helpers";

describe("container layout mode updates", () => {
  it("changes only layout mode when selecting stack", () => {
    const container = {
      type: "container" as const,
      id: "container",
      hidden: false,
      direction: "row" as const,
      distribution: "space-between" as const,
      horizontalAlign: "center" as const,
      verticalAlign: "end" as const,
      style: { width: "80%" },
      children: [],
    };

    expect(updateContainerLayoutMode(container, "stack")).toEqual({
      ...container,
      layoutMode: "stack",
    });
  });

  it("preserves flow settings when switching back to flow", () => {
    const container = {
      type: "container" as const,
      id: "container",
      hidden: false,
      direction: "column" as const,
      distribution: "space-around" as const,
      horizontalAlign: "center" as const,
      verticalAlign: "center" as const,
      children: [],
      layoutMode: "stack" as const,
    };

    expect(updateContainerLayoutMode(container, "flow")).toEqual({
      ...container,
      layoutMode: "flow",
    });
  });

  it("preserves layout mode when container placement becomes absolute", () => {
    const container = {
      type: "container" as const,
      id: "container",
      hidden: false,
      direction: "column" as const,
      layoutMode: "stack" as const,
      style: { width: "80%" },
      children: [],
    };

    expect(
      updatePlacementMode(container.style, "absolute"),
    ).toEqual({
      width: "80%",
      placement: { mode: "absolute" },
    });
  });

  it("keeps placement when layout mode changes", () => {
    const container = {
      type: "container" as const,
      id: "container",
      hidden: false,
      direction: "column" as const,
      layoutMode: "stack" as const,
      style: { placement: { mode: "absolute" as const, anchor: "center" as const } },
      children: [],
    };

    expect(updateContainerLayoutMode(container, "flow")).toEqual({
      ...container,
      layoutMode: "flow",
    });
  });
});
