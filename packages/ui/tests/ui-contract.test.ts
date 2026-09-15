import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BUTTON_SIZES, BUTTON_VARIANTS, TOPBAR_SLOT_ORDER } from "../src/index";

describe("application UI contracts", () => {
  it("exposes semantic button variants and density sizes", () => {
    expect(BUTTON_VARIANTS).toEqual(["primary", "secondary", "ghost", "archive", "stop", "danger"]);
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

  it("defines distinct lifecycle action treatments", () => {
    const css = readFileSync(fileURLToPath(new URL("../src/app-ui.css", import.meta.url)), "utf8");

    expect(css).toContain(".ps-ui-button--archive");
    expect(css).toContain(".ps-ui-button--stop");
    expect(css).toContain(".ps-ui-button--danger");
    expect(css).toContain("--ps-ui-semantic-warning");
    expect(css).toContain("--ps-ui-semantic-archive");
    expect(css).toContain("--ps-ui-semantic-archive-hover");
    expect(css).toContain("--ps-ui-semantic-stop");
    expect(css).toContain("--ps-ui-semantic-stop-hover");
    expect(css).toContain("--ps-ui-semantic-danger");
    expect(css).toContain("--ps-ui-semantic-danger-border");
  });

  it("uses one canonical border-width source for semantic buttons", () => {
    const css = readFileSync(fileURLToPath(new URL("../src/app-ui.css", import.meta.url)), "utf8");

    expect(css).toContain("border: var(--ps-ui-border-width-default) solid var(--ps-ui-border-default);");
    expect(css).not.toContain(".ps-ui-button--archive { border-width:");
    expect(css).not.toContain(".ps-ui-button--stop { border-width:");
    expect(css).not.toContain(".ps-ui-button--danger { border-width:");
    expect(css).toContain(".ps-ui-button--danger { border-color: var(--ps-ui-semantic-danger-border);");
  });
});
