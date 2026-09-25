import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const baseCss = readFileSync(new URL("../src/base.css", import.meta.url), "utf8");

function cssBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = baseCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) throw new Error(`Missing CSS block for ${selector}`);
  return match[1];
}

describe("Container foreground fallback theme contract", () => {
  it("keeps role-specific Text fallbacks behind the Container color", () => {
    expect(cssBlock(".presentation-text")).toContain("color: var(--presentation-container-color, var(--presentation-text-primary));");
    expect(cssBlock(".presentation-text-subtitle")).toContain("color: var(--presentation-container-color, var(--presentation-text-secondary));");
    expect(cssBlock(".presentation-text-caption")).toContain("color: var(--presentation-container-color, var(--presentation-text-muted));");
  });

  it("keeps Topics and Table defaults while allowing Container and local Table colors", () => {
    expect(baseCss).toContain("--presentation-topic-color: var(--presentation-container-color, var(--presentation-text-primary));");
    expect(baseCss).toContain("--presentation-topic-marker-color: currentColor;");
    expect(cssBlock(".presentation-table-frame")).toContain("color: var(--presentation-table-color, var(--presentation-container-color, var(--presentation-text-secondary)));");
    expect(cssBlock(".presentation-table th")).toContain("color: var(--presentation-table-color, var(--presentation-container-color, var(--presentation-text-primary)));");
  });
});
