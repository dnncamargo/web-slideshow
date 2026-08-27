import { describe, expect, it } from "vitest";

import { addPickedColor, arePickedColorsEquivalent, removePickedColor } from "../src/features/editor/inspector/sections/picked-colors-helpers";

describe("picked color session helpers", () => {
  it("deduplicates equivalent values while preserving most-recent-first order", () => {
    const first = addPickedColor([], "#facc15");
    const second = addPickedColor(first, "rgba(250, 204, 21, 1)");
    const third = addPickedColor(second, "#2563eb");
    expect(second).toEqual(["#facc15"]);
    expect(third).toEqual(["#2563eb", "#facc15"]);
    expect(arePickedColorsEquivalent("#facc15", "rgba(250, 204, 21, 1)")).toBe(true);
  });

  it("removes only the matching picked shortcut", () => {
    expect(removePickedColor(["#2563eb", "#facc15"], "rgba(250, 204, 21, 1)")).toEqual(["#2563eb"]);
  });

  it("has no maximum collection size", () => {
    const colors = Array.from({ length: 9 }, (_, index) => `#${String(index + 1).padStart(6, "0")}`);
    expect(colors.reduce(addPickedColor, [])).toHaveLength(9);
  });
});
