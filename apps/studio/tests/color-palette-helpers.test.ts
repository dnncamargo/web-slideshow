import { describe, expect, it } from "vitest";

import {
  addPaletteColor,
  arePaletteColorsEquivalent,
  removePaletteColor,
} from "../src/features/editor/inspector/sections/color-palette-helpers";

describe("presentation color palette helpers", () => {
  it("adds a new palette color", () => {
    expect(addPaletteColor(["#7c3aed"], "#ffffff")).toEqual([
      "#7c3aed",
      "#ffffff",
    ]);
  });

  it("prevents duplicates across equivalent formats", () => {
    expect(arePaletteColorsEquivalent("#fff", "rgba(255, 255, 255, 1)")).toBe(
      true,
    );
    expect(addPaletteColor(["#ffffff"], "rgba(255, 255, 255, 1)")).toEqual([
      "#ffffff",
    ]);
  });

  it("removes only the selected palette entry", () => {
    expect(removePaletteColor(["#111111", "#222222", "#333333"], 1)).toEqual([
      "#111111",
      "#333333",
    ]);
  });
});
