import { describe, expect, it } from "vitest";

import { PowerShowElementSchema } from "../src/elements";

function createText(layout?: unknown) {
  return {
    type: "text",
    id: "text",
    hidden: false,
    content: "Positioned text",
    ...(layout === undefined ? {} : { layout }),
  };
}

describe("canonical text positioning", () => {
  it("accepts flow text without layout", () => {
    expect(PowerShowElementSchema.safeParse(createText()).success).toBe(true);
  });

  it("accepts absolute text with direct edges", () => {
    expect(
      PowerShowElementSchema.safeParse(
        createText({ position: "absolute", top: "10%", right: 20, bottom: 4, left: 8 }),
      ).success,
    ).toBe(true);
  });

  it("rejects legacy placement and unsupported sizing", () => {
    expect(PowerShowElementSchema.safeParse(createText({ width: 100 })).success).toBe(false);
    expect(
      PowerShowElementSchema.safeParse({ ...createText(), style: { placement: { mode: "absolute" } } }).success,
    ).toBe(false);
  });

  it("requires absolute positioning for authored edges", () => {
    expect(PowerShowElementSchema.safeParse(createText({ left: 10 })).success).toBe(false);
  });
});
