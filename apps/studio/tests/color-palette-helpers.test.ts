import { describe, expect, it } from "vitest";

import {
  addPaletteColor,
  arePaletteColorsEquivalent,
  removePaletteColor,
} from "../src/features/editor/inspector/sections/color-palette-helpers";

describe("presentation color palette helpers", () => {
  it("adds a new palette color", () => {
    expect(addPaletteColor([
      { id: "#7c3aed", name: "#7c3aed", value: "#7c3aed" },
    ], "#ffffff")).toEqual([
      { id: "#7c3aed", name: "#7c3aed", value: "#7c3aed" },
      { id: "#ffffff", name: "#ffffff", value: "#ffffff" },
    ]);
  });

  it("prevents duplicates across equivalent formats", () => {
    expect(arePaletteColorsEquivalent(
      { id: "white", name: "White", value: "#fff" },
      "rgba(255, 255, 255, 1)",
    )).toBe(
      true,
    );
    expect(addPaletteColor([
      { id: "#ffffff", name: "#ffffff", value: "#ffffff" },
    ], "rgba(255, 255, 255, 1)")).toEqual([
      { id: "#ffffff", name: "#ffffff", value: "#ffffff" },
    ]);
  });

  it("removes only the selected palette entry", () => {
    expect(removePaletteColor([
      { id: "#111111", name: "#111111", value: "#111111" },
      { id: "#222222", name: "#222222", value: "#222222" },
      { id: "#333333", name: "#333333", value: "#333333" },
    ], 1)).toEqual([
      { id: "#111111", name: "#111111", value: "#111111" },
      { id: "#333333", name: "#333333", value: "#333333" },
    ]);
  });
});
