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

  it("accepts the canonical Divider namespaces", () => {
    const result = PowerShowElementSchema.safeParse(
      divider({
        orientation: "vertical",

        layout: {
          width: "2px",
          height: "100%",
          position: "absolute",
          left: 4,
        },
        style: {
          background: { color: "#334155" },
          borderRadius: 4,
        },
        effect: { opacity: 0.8 },
      }),
    );

    expect(result.success).toBe(true);
  });

  it.each([
    { style: { width: 10 } },
    { style: { opacity: 0.5 } },
    { style: { border: { width: 1 } } },
    { effect: { shadow: { color: "#000", blur: 2, offsetX: 0, offsetY: 0 } } },
    { typography: { fontSize: 12 } },
    { layout: { margin: 1 } },
  ])("rejects unsupported canonical entitlement %#", (unsupported) => {
    expect(PowerShowElementSchema.safeParse(divider(unsupported)).success).toBe(false);
  });
});
