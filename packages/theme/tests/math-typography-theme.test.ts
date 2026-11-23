import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveEffectiveElementStyleDefaults } from "../src/element-style-defaults";

describe("Math typography theme integration", () => {
  it("keeps KaTeX's mathematical font family while allowing authored weight and style", () => {
    const css = readFileSync(new URL("../src/base.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.presentation-math-weight \.katex\s*\{[^}]*font-weight:\s*inherit;/s);
    expect(css).toMatch(/\.presentation-math-style \.katex\s*\{[^}]*font-style:\s*inherit;/s);
    expect(css).not.toMatch(/\.presentation-math-(?:weight|style) \.katex\s*\{[^}]*font-family:/s);
    expect(css).not.toMatch(/\.presentation-math-(?:weight|style) \.katex\s*\{[^}]*font\s*:/s);
  });

  it("uses no Text typography baseline and has square-corner defaults", () => {
    expect(resolveEffectiveElementStyleDefaults({ type: "math" })).toEqual({ borderRadius: 0 });
  });
});
