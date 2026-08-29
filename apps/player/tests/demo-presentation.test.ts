import { describe, expect, it } from "vitest";

import { demoPresentation } from "../src/demo-presentation";

describe("canonical demo presentation", () => {
  it("imports as a validated current presentation with all eight slides", () => {
    expect(demoPresentation.schemaVersion).toBe(1);
    expect(demoPresentation.slides).toHaveLength(8);
    expect(demoPresentation.slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-2",
      "slide-3",
      "slide-4",
      "slide-5",
      "slide-6",
      "slide-7",
      "slide-8",
    ]);
  });
});
