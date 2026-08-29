import { describe, expect, it } from "vitest";

import { PowerShowElementSchema } from "../src/elements";

const minimalContainer = {
  id: "container",
  type: "container" as const,
  hidden: false,
  children: [],
};

function containerWithFit(
  fit: Record<string, unknown> = {
    mode: "contain",
    sourceWidth: 800,
    sourceHeight: 400,
  },
) {
  return {
    ...minimalContainer,
    layout: { children: { fit } },
  };
}

describe("Container children fit schema", () => {
  it.each(["contain", "cover", "fill"] as const)("accepts %s", (mode) => {
    const result = PowerShowElementSchema.safeParse(
      containerWithFit({ mode, sourceWidth: 800, sourceHeight: 400 }),
    );

    expect(result.success).toBe(true);
  });

  it("accepts nested Containers with independent fit objects", () => {
    const result = PowerShowElementSchema.safeParse({
      ...containerWithFit({ mode: "cover", sourceWidth: 1200, sourceHeight: 600 }),
      children: [
        containerWithFit({ mode: "fill", sourceWidth: 300, sourceHeight: 200 }),
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts Containers with omitted fit", () => {
    expect(PowerShowElementSchema.safeParse(minimalContainer).success).toBe(true);
    expect(PowerShowElementSchema.parse(minimalContainer)).toEqual(minimalContainer);
  });

  it.each([
    { mode: "none", sourceWidth: 800, sourceHeight: 400 },
    { mode: "stretch", sourceWidth: 800, sourceHeight: 400 },
    { sourceWidth: 800, sourceHeight: 400 },
    { mode: "contain", sourceHeight: 400 },
    { mode: "contain", sourceWidth: 800 },
    { mode: "contain", sourceWidth: 0, sourceHeight: 400 },
    { mode: "contain", sourceWidth: 800, sourceHeight: 0 },
    { mode: "contain", sourceWidth: -1, sourceHeight: 400 },
    { mode: "contain", sourceWidth: 800, sourceHeight: -1 },
    { mode: "contain", sourceWidth: Number.NaN, sourceHeight: 400 },
    { mode: "contain", sourceWidth: 800, sourceHeight: Number.POSITIVE_INFINITY },
    { mode: "contain", sourceWidth: 800, sourceHeight: 400, extra: true },
  ])("rejects malformed fit %#", (fit) => {
    expect(PowerShowElementSchema.safeParse(containerWithFit(fit)).success).toBe(false);
  });
});
