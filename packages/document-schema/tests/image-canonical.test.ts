import { describe, expect, it } from "vitest";

import { ImageElementSchema } from "../src/elements";

const baseImage = {
  id: "image",
  type: "image",
  src: "/image.png",
};

describe("canonical Image contract", () => {
  it("accepts only the canonical layout, visual, effect, link, and image fields", () => {
    const result = ImageElementSchema.safeParse({
      ...baseImage,
      layout: { width: "60%", height: 240, position: "absolute", top: 12, right: "4%", bottom: 8, left: 24 },
      style: { border: { width: 1, color: "#fff" }, borderRadius: 8, className: "hero" },
      effect: { opacity: 0.8, shadow: { x: 0, y: 4, blur: 12, color: "#000" } },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
      alt: "Example",
      fit: "cover",
      focalPoint: { x: 25, y: 70 },
      hidden: false,
    });

    expect(result.success).toBe(true);
  });

  it.each([
    { style: { width: 200 } },
    { style: { height: 200 } },
    { style: { opacity: 0.5 } },
    { style: { shadow: { x: 0, y: 1, blur: 2, color: "#000" } } },
    { style: { placement: { mode: "absolute" } } },
    { style: { color: "#fff" } },
    { style: { background: "#000" } },
    { typography: { fontSize: 20 } },
    { layout: { margin: 2 } },
    { layout: { padding: 2 } },
    { layout: { overflow: "hidden" } },
  ])("rejects legacy or unsupported Image properties %o", (extra) => {
    expect(ImageElementSchema.safeParse({ ...baseImage, ...extra }).success).toBe(false);
  });
});
