import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

  it("defines the canonical editable input surface tokens", () => {
    const css = readFileSync(fileURLToPath(new URL("../src/app-ui.css", import.meta.url)), "utf8");

    expect(css).toContain("--ps-ui-background-input: #0c111a;");
    expect(css).toContain("--ps-ui-border-input: var(--ps-ui-border-default);");
    expect(css).toContain("--ps-ui-radius-input: 7px;");
  });
});
