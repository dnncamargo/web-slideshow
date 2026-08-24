import { describe, expect, it } from "vitest";

import { ImageElementSchema } from "../src/elements";

const image = (crop: unknown) => ({
  id: "image",
  type: "image",
  src: "/image.png",
  crop,
});

describe("canonical Image crop contract", () => {
  it("accepts source-relative crop percentages and boundary endpoints", () => {
    expect(ImageElementSchema.safeParse(image({ x: 10, y: 20, width: 60, height: 50 })).success).toBe(true);
    expect(ImageElementSchema.safeParse(image({ x: 0, y: 0, width: 100, height: 100 / 2 })).success).toBe(true);
    expect(ImageElementSchema.safeParse(image({ x: 50, y: 50, width: 50, height: 50 })).success).toBe(true);
  });

  it.each([
    { x: -1, y: 0, width: 10, height: 10 },
    { x: 100, y: 0, width: 1, height: 10 },
    { x: 0, y: -1, width: 10, height: 10 },
    { x: 0, y: 100, width: 10, height: 1 },
    { x: 0, y: 0, width: 0, height: 10 },
    { x: 0, y: 0, width: 10, height: 0 },
    { x: 0, y: 0, width: 101, height: 10 },
    { x: 0, y: 0, width: 10, height: 101 },
    { x: 95, y: 0, width: 10, height: 10 },
    { x: 0, y: 95, width: 10, height: 10 },
    { x: 0, y: 0, width: 100, height: 100, extra: true },
  ])("rejects invalid or redundant crop %o", (crop) => {
    expect(ImageElementSchema.safeParse(image(crop)).success).toBe(false);
  });

  it("rejects unknown crop fields while preserving no-crop absence", () => {
    expect(ImageElementSchema.safeParse(image({ x: 10, y: 10, width: 20, height: 20, zoom: 2 })).success).toBe(false);
    const result = ImageElementSchema.parse({ id: "image", type: "image", src: "/image.png" });
    expect(result.crop).toBeUndefined();
  });
});
