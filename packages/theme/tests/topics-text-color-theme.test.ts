import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const baseCss = readFileSync(new URL("../src/base.css", import.meta.url), "utf8");

describe("Topics text color precedence", () => {
  it("applies authority only to the direct block Text element", () => {
    expect(baseCss).toContain(
      ".powershow-topic-item-text-color-authority > .powershow-text {\n  color: var(--powershow-topic-color) !important;",
    );
    expect(baseCss).not.toContain(".powershow-text span");
    expect(baseCss).not.toContain(".powershow-text a");
    expect(baseCss).not.toContain(".powershow-text strong");
    expect(baseCss).not.toContain(".powershow-text em");
    expect(baseCss).not.toContain(".powershow-text code");
  });
});
