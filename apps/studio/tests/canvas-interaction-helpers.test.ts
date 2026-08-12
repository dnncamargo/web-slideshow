import { describe, expect, it } from "vitest";

import { shouldIgnoreCanvasBackgroundClick } from "../src/features/editor/canvas-interaction-helpers";

describe("canvas pointer selection guard", () => {
  it("suppresses only the click following a captured element interaction", () => {
    expect(shouldIgnoreCanvasBackgroundClick("absolute-text")).toBe(true);
    expect(shouldIgnoreCanvasBackgroundClick(null)).toBe(false);
  });
});
