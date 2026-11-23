import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/base.css", import.meta.url), "utf8");

describe("Math vertical and horizontal overflow theme", () => {
  it("isolates horizontal scrolling inside an auto-height Math child wrapper", () => {
    expect(css).toMatch(/\.presentation-math-scroll\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*visible;/s);
    expect(css).not.toMatch(/\.presentation-math\s*\{[^}]*overflow-/s);
  });
});
