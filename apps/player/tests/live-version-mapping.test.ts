import { describe, expect, it } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import { mapPromotedSlideIndex } from "../src/live-version-mapping";
import { playerTestPresentation } from "./fixtures/player-presentation";

function withSlideOrder(ids: string[]): Presentation {
  return {
    ...playerTestPresentation,
    slides: ids.map((id) => {
      const existing = playerTestPresentation.slides.find(
        (slide) => slide.id === id,
      );
      return (
        existing ?? { id, title: "", summary: "", speakerNotes: "", elements: [] }
      );
    }),
  };
}

describe("live version promotion mapping", () => {
  it("preserves the logical slide id across insertion and reorder", () => {
    expect(
      mapPromotedSlideIndex(
        withSlideOrder(["slide-1", "slide-2", "slide-3"]),
        withSlideOrder(["slide-3", "inserted", "slide-1", "slide-2"]),
        1,
      ),
    ).toBe(3);
  });

  it("falls back to a clamped confirmed index when the slide was removed", () => {
    expect(
      mapPromotedSlideIndex(
        withSlideOrder(["slide-1", "slide-2", "slide-3"]),
        withSlideOrder(["slide-1"]),
        2,
      ),
    ).toBe(0);
  });
});
