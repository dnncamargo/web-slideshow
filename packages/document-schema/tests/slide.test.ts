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
  it("rejects image combined with gradient", () => {
    const result = SlideSchema.safeParse({
      id: "slide-invalid-gradient-background",
      elements: [],

      background: {
        image: "/background.jpg",

        gradient: {
          type: "linear",
          angle: 135,

          stops: [
            {
              color: "#7c3aed",
              position: 0,
            },
            {
              color: "#06b6d4",
              position: 100,
            },
          ],
        },
      },
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message ===
            "Slide background image cannot currently be combined with pattern or gradient.",
        ),
      ).toBe(true);
    }
  });
  it("rejects image combined with pattern", () => {
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
            "Slide background image cannot currently be combined with pattern or gradient.",
        ),
      ).toBe(true);
    }
  });
  it("accepts gradient combined with pattern", () => {
    const result = SlideSchema.safeParse({
      id: "slide-gradient-pattern",
      elements: [],

      background: {
        gradient: {
          type: "linear",

          stops: [
            {
              color: "#111827",
              position: 0,
            },
            {
              color: "#1f2937",
              position: 100,
            },
          ],
        },

        pattern: {
          type: "grid",
          color: "#374151",
          size: 24,
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
