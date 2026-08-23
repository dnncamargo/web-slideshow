import { describe, expect, it } from "vitest";

import { PowerShowElementSchema } from "../src/elements";
import { SignedLengthSchema } from "../src/primitives";

function createContainer(children: unknown[] = []) {
  return {
  type: "container",
  id: "container",
  hidden: false,
  children
};
}

function createText(placement?: unknown) {
  return {
    type: "text",
    id: "text",
    hidden: false,
    content: "Positioned text",
    ...(placement === undefined ? {} : { style: { placement } }),
  };
}

describe("semantic element placement", () => {
  it("keeps existing elements valid without placement", () => {
    expect(PowerShowElementSchema.safeParse(createText()).success).toBe(true);
  });

  it("accepts flow and absolute placement", () => {
    for (const mode of ["flow", "absolute"] as const) {
      expect(
        PowerShowElementSchema.safeParse(createText({ mode })).success,
      ).toBe(true);
    }
  });

  it("accepts every semantic anchor", () => {
    for (const anchor of [
      "top-left",
      "top",
      "top-right",
      "left",
      "center",
      "right",
      "bottom-left",
      "bottom",
      "bottom-right",
    ]) {
      expect(
        PowerShowElementSchema.safeParse(createText({ mode: "absolute", anchor }))
          .success,
      ).toBe(true);
    }
  });

  it("rejects invalid anchors and offsets", () => {
    expect(
      PowerShowElementSchema.safeParse(
        createText({ mode: "absolute", anchor: "middle" }),
      ).success,
    ).toBe(false);
    expect(
      PowerShowElementSchema.safeParse(
        createText({ mode: "absolute", offsetX: "1rem" }),
      ).success,
    ).toBe(false);
  });

  it("accepts signed pixel and percentage offsets", () => {
    expect(SignedLengthSchema.safeParse("-20px").success).toBe(true);
    expect(SignedLengthSchema.safeParse("-15%").success).toBe(true);
  });

  it("accepts nested positioned elements", () => {
    expect(
      PowerShowElementSchema.safeParse(
        createContainer([
          createContainer([
            createText({
              mode: "absolute",
              anchor: "bottom-right",
              offsetX: "-20px",
              offsetY: "-15%",
            }),
          ]),
        ]),
      ).success,
    ).toBe(true);
  });
});
