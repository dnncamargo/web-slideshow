import { describe, expect, it } from "vitest";

import { addPickedColor, arePickedColorsEquivalent, removePickedColor } from "../src/features/editor/inspector/sections/picked-colors-helpers";

describe("picked color session helpers", () => {
  it("deduplicates equivalent values and moves a reselected color to the front", () => {
    const first = addPickedColor([], "#facc15");
    const second = addPickedColor(first, "rgba(250, 204, 21, 1)");
    const third = addPickedColor(second, "#2563eb");
    const fourth = addPickedColor(third, "rgba(250, 204, 21, 1)");
    expect(second).toEqual(["rgba(250, 204, 21, 1)"]);
    expect(third).toEqual(["#2563eb", "rgba(250, 204, 21, 1)"]);
    expect(fourth).toEqual(["rgba(250, 204, 21, 1)", "#2563eb"]);
    expect(arePickedColorsEquivalent("#facc15", "rgba(250, 204, 21, 1)")).toBe(true);
  });

  it("removes only the matching picked shortcut", () => {
    expect(removePickedColor(["#2563eb", "#facc15"], "rgba(250, 204, 21, 1)")).toEqual(["#2563eb"]);
  });

  it("caps history at 16 and evicts the oldest color", () => {
    const colors = Array.from({ length: 17 }, (_, index) => `#${String(index + 1).padStart(6, "0")}`);
    const result = colors.reduce(addPickedColor, []);
    expect(result).toHaveLength(16);
    expect(result[0]).toBe("#000017");
    expect(result).not.toContain("#000001");
  });
});
