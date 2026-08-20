import { describe, expect, it } from "vitest";

import { PowerShowElementSchema } from "../src/elements";

function divider(overrides: Record<string, unknown> = {}) {
  return {
    id: "divider-1",

    type: "divider",

    hidden: false,

    ...overrides,
  };
}

describe("Divider element schema", () => {
  it("parses as a PowerShowElement", () => {
    const result = PowerShowElementSchema.safeParse(divider());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("divider");
    }
  });

  it("defaults a missing orientation to horizontal", () => {
    const result = PowerShowElementSchema.safeParse(divider());

    expect(result.success).toBe(true);

    if (result.success && result.data.type === "divider") {
      expect(result.data.orientation).toBe("horizontal");
    }
  });

  it.each(["horizontal", "vertical"] as const)(
    "accepts %s orientation",
    (orientation) => {
      const result = PowerShowElementSchema.safeParse(
        divider({ orientation }),
      );

      expect(result.success).toBe(true);
    },
  );

  it("rejects an invalid orientation", () => {
    const result = PowerShowElementSchema.safeParse(
      divider({ orientation: "diagonal" }),
    );

    expect(result.success).toBe(false);
  });

  it("accepts a normal ElementStyle", () => {
    const result = PowerShowElementSchema.safeParse(
      divider({
        orientation: "vertical",

        style: {
          width: "2px",

          height: "100%",

          background: "#334155",

          opacity: 0.8,

          borderRadius: 4,
        },
      }),
    );

    expect(result.success).toBe(true);
  });
});