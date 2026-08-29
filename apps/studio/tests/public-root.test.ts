import { describe, expect, it } from "vitest";

import pageSource from "../src/app/page.tsx?raw";

describe("public root", () => {
  it("offers PowerShow, Studio, and Player without the old idle copy", () => {
    expect(pageSource).toContain("PowerShow");
    expect(pageSource).toContain(">\n            Studio\n");
    expect(pageSource).toContain(">\n              Player\n");
    expect(pageSource).not.toContain("public.library");
    expect(pageSource).not.toContain("public.play");
    expect(pageSource).not.toContain("public.noLive");
  });

  it("uses the configured Player demo as a visual-only presentation frame", () => {
    expect(pageSource).toContain("${player.baseUrl}/demo");
    expect(pageSource).toContain('tabIndex={-1}');
  });
});
