import { describe, expect, it } from "vitest";

import {
  updatePlacementAnchor,
  updatePlacementMode,
  updatePlacementOffset,
} from "../src/features/editor/inspector/sections/element-placement-helpers";
import { moveElementToSiblingIndexById } from "../src/features/editor/element-operations";

describe("element placement updates", () => {
  it("preserves dormant placement details when toggling flow and absolute", () => {
    const absolute = updatePlacementMode(
      {
        color: "#ffffff",
        placement: { mode: "absolute", anchor: "bottom-right", offsetX: "-20px", offsetY: "-10%" },
      },
      "flow",
    );

    expect(updatePlacementMode(absolute, "absolute")).toEqual({
      color: "#ffffff",
      placement: { mode: "absolute", anchor: "bottom-right", offsetX: "-20px", offsetY: "-10%" },
    });
  });

  it("updates anchor and each offset without changing other placement state", () => {
    const style = { placement: { mode: "absolute" as const, anchor: "center" as const, offsetX: "10px", offsetY: "20px" } };
    const anchored = updatePlacementAnchor(style, "top-left");
    const xUpdated = updatePlacementOffset(anchored, "x", "-10%");

    expect(anchored.placement?.offsetY).toBe("20px");
    expect(xUpdated.placement).toEqual({ mode: "absolute", anchor: "top-left", offsetX: "-10%", offsetY: "20px" });
  });
});

describe("layer ordering", () => {
  const elements = [
    { type: "text" as const, id: "first", hidden: false, content: "First", variant: "body" as const },
    { type: "text" as const, id: "selected", hidden: false, content: "Selected", variant: "body" as const },
    { type: "text" as const, id: "last", hidden: false, content: "Last", variant: "body" as const },
  ];

  it("moves siblings to each layer boundary and preserves selected identity", () => {
    expect(moveElementToSiblingIndexById(elements, "selected", 0).map((element) => element.id)).toEqual(["selected", "first", "last"]);
    expect(moveElementToSiblingIndexById(elements, "selected", 1).map((element) => element.id)).toEqual(["first", "selected", "last"]);
    expect(moveElementToSiblingIndexById(elements, "selected", 2).map((element) => element.id)).toEqual(["first", "last", "selected"]);
  });

  it("leaves boundary moves unchanged", () => {
    expect(moveElementToSiblingIndexById(elements, "first", 0)).toBe(elements);
    expect(moveElementToSiblingIndexById(elements, "last", 2)).toBe(elements);
  });
});
