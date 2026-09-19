import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const baseCss = readFileSync(new URL("../src/base.css", import.meta.url), "utf8");

describe("Plot axis theme fallbacks", () => {
  it("only applies default paint when authored SVG paint is absent", () => {
    expect(baseCss).toContain(".presentation-plot-axis:not([opacity]) {\n  opacity: 0.7;\n}");
    expect(baseCss).toContain(
      ".presentation-plot-axis:not([stroke]) {\n  stroke: var(--presentation-text-muted);\n}",
    );
    expect(baseCss).toContain(
      ".presentation-plot-axis-label:not([fill]) {\n  fill: var(--presentation-text-primary);\n}",
    );
    expect(baseCss).not.toMatch(/\.presentation-plot-axis\s*\{[^}]*\bstroke\s*:/s);
    expect(baseCss).not.toMatch(/\.presentation-plot-axis-label\s*\{[^}]*\bfill\s*:/s);
    expect(baseCss).not.toMatch(/\.presentation-plot-axis-label[^}]*\bopacity\s*:/s);
    expect(baseCss).toContain("font-family: var(--presentation-font-sans);");
    expect(baseCss).toContain("font-weight: 700;");
  });
});
