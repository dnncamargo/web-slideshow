import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BorderSchema,
  GradientSchema,
  ShadowSchema,
} from "../src/visual";

describe("GradientSchema", () => {
  it("accepts a linear gradient", () => {
    const result =
      GradientSchema.safeParse({
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
      });

    expect(result.success).toBe(true);
  });

  it("accepts a radial gradient", () => {
    const result =
      GradientSchema.safeParse({
        type: "radial",
        shape: "circle",

        stops: [
          {
            color: "#fff",
            position: 0,
          },
          {
            color: "#000",
            position: 100,
          },
        ],
      });

    expect(result.success).toBe(true);
  });

  it("requires at least two stops", () => {
    const result =
      GradientSchema.safeParse({
        type: "linear",

        stops: [
          {
            color: "#fff",
            position: 0,
          },
        ],
      });

    expect(result.success).toBe(false);
  });

  it("rejects unordered stops", () => {
    const result =
      GradientSchema.safeParse({
        type: "linear",

        stops: [
          {
            color: "#fff",
            position: 80,
          },
          {
            color: "#000",
            position: 20,
          },
        ],
      });

    expect(result.success).toBe(false);
  });
});

describe("BorderSchema", () => {
  it("accepts a color border", () => {
    expect(
      BorderSchema.safeParse({
        width: 2,
        style: "solid",
        color: "#fff",
      }).success,
    ).toBe(true);
  });

  it("accepts a gradient border", () => {
    expect(
      BorderSchema.safeParse({
        width: 2,

        gradient: {
          type: "linear",

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
      }).success,
    ).toBe(true);
  });

  it("rejects color and gradient together", () => {
    expect(
      BorderSchema.safeParse({
        width: 2,
        color: "#fff",

        gradient: {
          type: "linear",

          stops: [
            {
              color: "#fff",
              position: 0,
            },
            {
              color: "#000",
              position: 100,
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});

describe("ShadowSchema", () => {
  it("accepts a shadow", () => {
    expect(
      ShadowSchema.safeParse({
        x: 0,
        y: 16,
        blur: 40,
        spread: -8,
        color:
          "rgba(0,0,0,0.4)",
      }).success,
    ).toBe(true);
  });
});