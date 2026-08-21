import { describe, expect, it } from "vitest";

import { deriveThumbnailPreview } from "../src/features/persistence/presentation-persistence";
import {
  computeThumbnailScale,
  THUMBNAIL_LOGICAL_HEIGHT_16_9,
  THUMBNAIL_LOGICAL_HEIGHT_4_3,
  THUMBNAIL_LOGICAL_WIDTH,
  thumbnailLogicalHeight,
} from "../src/features/library/presentation-thumbnail-geometry";

function makeSlide(id: string, elements: unknown[]): unknown {
  return { id, elements };
}

function makePresentation(options: {
  aspectRatio?: "16:9" | "4:3";
  slides?: unknown[];
}): unknown {
  return {
    schemaVersion: 1,
    id: "presentation-1",
    title: "Presentation",
    aspectRatio: options.aspectRatio ?? "16:9",
    slides: options.slides ?? [],
  };
}

const textElement = {
  id: "text-1",
  type: "text",
  content: "Hello world",
};

describe("deriveThumbnailPreview", () => {
  it("derives a preview from a first slide that has authored elements", () => {
    const preview = deriveThumbnailPreview(
      makePresentation({
        aspectRatio: "4:3",
        slides: [makeSlide("slide-1", [textElement])],
      }),
    );

    expect(preview).toBeDefined();
    expect(preview?.aspectRatio).toBe("4:3");
    expect(preview?.firstSlide.id).toBe("slide-1");
    expect(preview?.firstSlide.elements.length).toBe(1);
  });

  it("defaults the aspect ratio to 16:9 when it is absent", () => {
    const raw = makePresentation({
      slides: [makeSlide("slide-1", [textElement])],
    });
    delete (raw as Record<string, unknown>).aspectRatio;

    const preview = deriveThumbnailPreview(raw);

    expect(preview?.aspectRatio).toBe("16:9");
  });

  it("uses only slides[0] and ignores later slides", () => {
    const preview = deriveThumbnailPreview(
      makePresentation({
        slides: [
          makeSlide("slide-1", [textElement]),
          makeSlide("slide-2", [{ id: "text-2", type: "text", content: "Second" }]),
        ],
      }),
    );

    expect(preview?.firstSlide.id).toBe("slide-1");
  });

  it("returns undefined when the first slide has no authored elements", () => {
    const preview = deriveThumbnailPreview(
      makePresentation({
        slides: [makeSlide("slide-1", [])],
      }),
    );

    expect(preview).toBeUndefined();
  });

  it("preserves the blank-slide fallback even when a background is configured", () => {
    const slideWithBackground = {
      id: "slide-1",
      elements: [],
      background: { color: "#000000" },
    };

    const preview = deriveThumbnailPreview(
      makePresentation({ slides: [slideWithBackground] }),
    );

    expect(preview).toBeUndefined();
  });

  it("returns undefined when the presentation has no first slide", () => {
    const preview = deriveThumbnailPreview(makePresentation({ slides: [] }));

    expect(preview).toBeUndefined();
  });

  it("returns undefined for a non-object first slide", () => {
    const preview = deriveThumbnailPreview(
      makePresentation({ slides: [null] }),
    );

    expect(preview).toBeUndefined();
  });

  it("returns undefined without throwing for malformed slide data", () => {
    const preview = deriveThumbnailPreview(
      makePresentation({
        slides: [{ id: "slide-1", elements: [{ type: "text" }] }],
      }),
    );

    expect(preview).toBeUndefined();
  });

  it("does not throw for non-object presentation input", () => {
    expect(deriveThumbnailPreview(null)).toBeUndefined();
    expect(deriveThumbnailPreview(undefined)).toBeUndefined();
    expect(deriveThumbnailPreview("not-an-object")).toBeUndefined();
  });
});

describe("presentation-thumbnail-geometry", () => {
  it("exposes the 16:9 logical canvas height", () => {
    expect(thumbnailLogicalHeight("16:9")).toBe(THUMBNAIL_LOGICAL_HEIGHT_16_9);
    expect(THUMBNAIL_LOGICAL_HEIGHT_16_9).toBe(THUMBNAIL_LOGICAL_WIDTH * (9 / 16));
  });

  it("exposes the 4:3 logical canvas height", () => {
    expect(thumbnailLogicalHeight("4:3")).toBe(THUMBNAIL_LOGICAL_HEIGHT_4_3);
    expect(THUMBNAIL_LOGICAL_HEIGHT_4_3).toBe(THUMBNAIL_LOGICAL_WIDTH * (3 / 4));
  });

  it("fits a 16:9 logical canvas exactly inside a 16:9 host", () => {
    const hostWidth = 112;
    const hostHeight = hostWidth * (9 / 16);
    const scale = computeThumbnailScale(
      hostWidth,
      hostHeight,
      THUMBNAIL_LOGICAL_WIDTH,
      THUMBNAIL_LOGICAL_HEIGHT_16_9,
    );

    expect(scale).toBeCloseTo(hostWidth / THUMBNAIL_LOGICAL_WIDTH);
    expect(THUMBNAIL_LOGICAL_WIDTH * scale).toBeCloseTo(hostWidth);
    expect(THUMBNAIL_LOGICAL_HEIGHT_16_9 * scale).toBeCloseTo(hostHeight);
  });

  it("preserves 4:3 ratio with horizontal letterboxing in a 16:9 host", () => {
    const hostWidth = 112;
    const hostHeight = hostWidth * (9 / 16);
    const scale = computeThumbnailScale(
      hostWidth,
      hostHeight,
      THUMBNAIL_LOGICAL_WIDTH,
      THUMBNAIL_LOGICAL_HEIGHT_4_3,
    );

    const scaledWidth = THUMBNAIL_LOGICAL_WIDTH * scale;
    const scaledHeight = THUMBNAIL_LOGICAL_HEIGHT_4_3 * scale;

    // Fits entirely inside the host without stretching.
    expect(scaledWidth).toBeLessThanOrEqual(hostWidth);
    expect(scaledHeight).toBeLessThanOrEqual(hostHeight);
    // Height fills the slot while width leaves unused horizontal space.
    expect(scaledHeight).toBeCloseTo(hostHeight);
    expect(scaledWidth).toBeLessThan(hostWidth);
    // Ratio is preserved.
    expect(scaledWidth / scaledHeight).toBeCloseTo(4 / 3);
  });

  it("changes the computed scale when the host width changes", () => {
    const desktop = computeThumbnailScale(
      112,
      63,
      THUMBNAIL_LOGICAL_WIDTH,
      THUMBNAIL_LOGICAL_HEIGHT_16_9,
    );
    const mobile = computeThumbnailScale(
      86,
      86 * (9 / 16),
      THUMBNAIL_LOGICAL_WIDTH,
      THUMBNAIL_LOGICAL_HEIGHT_16_9,
    );

    expect(mobile).toBeLessThan(desktop);
    expect(mobile).toBeCloseTo(86 / THUMBNAIL_LOGICAL_WIDTH);
  });

  it("returns zero for non-positive or non-finite dimensions", () => {
    expect(computeThumbnailScale(0, 63, 960, 540)).toBe(0);
    expect(computeThumbnailScale(112, 0, 960, 540)).toBe(0);
    expect(computeThumbnailScale(112, 63, 0, 540)).toBe(0);
    expect(computeThumbnailScale(NaN, 63, 960, 540)).toBe(0);
    expect(computeThumbnailScale(112, Infinity, 960, 540)).toBe(0);
  });
});
