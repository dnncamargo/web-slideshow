import { describe, expect, it } from "vitest";

import { SlideSchema } from "../src/slide";

describe("SlideSchema", () => {
  it("accepts a background image", () => {
    const result = SlideSchema.safeParse({
      id: "slide-image",
      elements: [],

      background: {
        image: "/background.jpg",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a background pattern", () => {
    const result = SlideSchema.safeParse({
      id: "slide-pattern",
      elements: [],

      background: {
        color: "#101218",

        pattern: {
          type: "dots",
          color: "#343944",
          size: 24,
          opacity: 0.7,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects image and pattern together", () => {
    const result = SlideSchema.safeParse({
      id: "slide-invalid-background",
      elements: [],

      background: {
        image: "/background.jpg",

        pattern: {
          type: "dots",
        },
      },
    });

    expect(result.success).toBe(false);
  });
  it("rejects image and pattern together", () => {
    const result = SlideSchema.safeParse({
      id: "slide-invalid-background",
      elements: [],

      background: {
        image: "/background.jpg",

        pattern: {
          type: "dots",
        },
      },
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message ===
            "Slide background cannot define both image and pattern.",
        ),
      ).toBe(true);
    }
  });
});
