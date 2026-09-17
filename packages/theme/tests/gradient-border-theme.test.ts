import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const baseCss = readFileSync(new URL("../src/base.css", import.meta.url), "utf8");

function cssBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = baseCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) {
    throw new Error(`Missing CSS block for ${selector}`);
  }
  return match[1];
}

describe("gradient border theme ownership", () => {
  it("keeps painting in the shared primitive and sizing in the Table class", () => {
    const sharedRing = cssBlock(".presentation-gradient-border::before");
    const tableFrame = cssBlock(".powershow-table-frame-gradient-border");

    expect(sharedRing).toContain("background: var(--presentation-gradient-border-paint)");
    expect(sharedRing).toContain("padding: var(--presentation-gradient-border-width, 1px)");
    expect(baseCss).not.toMatch(/\.presentation-gradient-border\s*\{/);
    expect(tableFrame).toContain("padding: var(--powershow-table-border-width)");
  });

  it("has one masked-ring implementation for the shared primitive", () => {
    expect(baseCss.match(/\.presentation-gradient-border::before\s*\{/g)).toHaveLength(1);

    const sharedRing = cssBlock(".presentation-gradient-border::before");
    expect(sharedRing.match(/-webkit-mask\s*:/g)).toHaveLength(1);
    expect(sharedRing.match(/(?<!-webkit-)mask\s*:/g)).toHaveLength(1);
    expect(sharedRing).toContain("mask-composite: exclude");
    expect(sharedRing).toContain("-webkit-mask-composite: xor");
  });
});
