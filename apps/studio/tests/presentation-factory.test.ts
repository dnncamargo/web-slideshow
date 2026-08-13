import { describe, expect, it } from "vitest";

import { PresentationSchema } from "@powershow/document-schema";

import {
  createBlankPresentation,
  createBlankSlide,
} from "../src/features/persistence/presentation-repository-instance";

describe("blank presentation factory", () => {
  it("creates a presentation with exactly one slide", () => {
    const presentation = createBlankPresentation();

    expect(presentation.slides).toHaveLength(1);
  });

  it("produces a schema-valid blank slide with no authored content", () => {
    const slide = createBlankSlide();

    expect(slide.elements).toEqual([]);
    expect(slide.background).toBeUndefined();
    expect(slide.title).toBe("");
  });

  it("keeps the whole presentation schema-valid", () => {
    const presentation = createBlankPresentation();
    const result = PresentationSchema.safeParse(presentation);

    expect(result.success).toBe(true);
  });

  it("generates distinct slide IDs for consecutive blank presentations", () => {
    const first = createBlankPresentation();
    const second = createBlankPresentation();

    expect(first.slides[0]?.id).toBeTruthy();
    expect(second.slides[0]?.id).toBeTruthy();
    expect(first.slides[0]?.id).not.toBe(second.slides[0]?.id);
  });
});