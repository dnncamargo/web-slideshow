import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const pageSource = readFileSync("src/app/page.tsx", "utf8");
const stylesSource = readFileSync("src/app/page.module.css", "utf8");

describe("public root meta links", () => {
  it("keeps Docs and GitHub discreetly available from the public portal", () => {
    expect(pageSource).toContain('<a href="/docs">Docs</a>');
    expect(pageSource).toContain('href="https://github.com/dnncamargo/web-slideshow"');
    expect(pageSource).toContain("styles.metaLinks");
    expect(stylesSource).toContain(".metaLinks");
    expect(stylesSource).toContain("position: absolute");
    expect(stylesSource).toContain("font-size: 11px");
  });
});
