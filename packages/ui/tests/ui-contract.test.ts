import { describe, expect, it } from "vitest";

import { BUTTON_SIZES, BUTTON_VARIANTS, TOPBAR_SLOT_ORDER } from "../src/index";

describe("application UI contracts", () => {
  it("exposes semantic button variants and density sizes", () => {
    expect(BUTTON_VARIANTS).toEqual(["primary", "secondary", "ghost", "danger"]);
    expect(BUTTON_SIZES).toEqual(["compact", "default", "touch"]);
  });

  it("keeps locale as a structural trailing topbar slot", () => {
    expect(TOPBAR_SLOT_ORDER).toEqual(["brand", "title", "actions", "locale"]);
  });
});
