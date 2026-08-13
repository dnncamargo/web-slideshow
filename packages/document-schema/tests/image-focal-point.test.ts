import { describe, expect, it } from "vitest";

import { ImageElementSchema } from "../src/elements";

function image(focalPoint?: unknown) {
  return {
    type: "image",
    id: "image",
    hidden: false,
    src: "/image.png",
    alt: "Example",
    fit: "cover",
    ...(focalPoint === undefined ? {} : { focalPoint }),
  };
}

describe("image focal point", () => {
  it("keeps images without a focal point valid", () => {
    expect(ImageElementSchema.safeParse(image()).success).toBe(true);
  });

  it.each([
    { x: 50, y: 50 },
    { x: 0, y: 0 },
    { x: 100, y: 100 },
  ])("accepts bounded focal point %o", (focalPoint) => {
    expect(ImageElementSchema.safeParse(image(focalPoint)).success).toBe(true);
  });

  it.each([
    { x: -1, y: 50 },
    { x: 101, y: 50 },
    { x: 50, y: -1 },
    { x: 50, y: 101 },
  ])("rejects out-of-range focal point %o", (focalPoint) => {
    expect(ImageElementSchema.safeParse(image(focalPoint)).success).toBe(false);
  });

  it("preserves unrelated image fields", () => {
    const result = ImageElementSchema.parse(image({ x: 20, y: 70 }));

    expect(result).toMatchObject({
      src: "/image.png",
      alt: "Example",
      fit: "cover",
      focalPoint: { x: 20, y: 70 },
    });
  });
});
