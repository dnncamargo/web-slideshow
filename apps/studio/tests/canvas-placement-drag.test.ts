import { describe, expect, it } from "vitest";

import {
  isCanvasDraggable,
  updatePlacementForCanvasDrag,
} from "../src/features/editor/inspector/sections/element-placement-helpers";

describe("canvas semantic placement drag", () => {
  it("only permits absolute placement", () => {
    expect(isCanvasDraggable({ placement: { mode: "flow" } })).toBe(false);
    expect(isCanvasDraggable({ placement: { mode: "absolute" } })).toBe(true);
  });

  it("updates pixel offsets while preserving anchor and unrelated style", () => {
    expect(
      updatePlacementForCanvasDrag(
        {
          color: "#ffffff",
          placement: { mode: "absolute", anchor: "bottom-right", offsetX: 20, offsetY: 10 },
        },
        30,
        -25,
        400,
        200,
      ),
    ).toEqual({
      color: "#ffffff",
      placement: { mode: "absolute", anchor: "bottom-right", offsetX: 50, offsetY: -15 },
    });
  });

  it("uses effective zero without writing offsets when there is no movement", () => {
    const style = { placement: { mode: "absolute" as const, anchor: "center" as const } };

    expect(updatePlacementForCanvasDrag(style, 0, 0, 400, 200)).toBe(style);
    expect(updatePlacementForCanvasDrag(style, 42, 0, 400, 200)).toEqual({
      placement: { mode: "absolute", anchor: "center", offsetX: 42 },
    });
  });

  it("preserves percentage units using direct parent dimensions", () => {
    expect(
      updatePlacementForCanvasDrag(
        { placement: { mode: "absolute", offsetX: "10%", offsetY: "-20%" } },
        40,
        50,
        400,
        200,
      ),
    ).toEqual({
      placement: { mode: "absolute", offsetX: "20%", offsetY: "5%" },
    });
  });
});
