import { describe, expect, it } from "vitest";

import pageSource from "../src/app/page.tsx?raw";

describe("public root", () => {
  it("offers PowerShow, Studio, and Player without the old idle copy", () => {
    expect(pageSource).toContain("PowerShow");
    expect(pageSource).toContain("Studio");
    expect(pageSource).toContain("Player");
    expect(pageSource).not.toContain("public.library");
    expect(pageSource).not.toContain("public.play");
    expect(pageSource).not.toContain("public.noLive");
  });

  it("uses the configured Player demo as a visual-only presentation frame", () => {
    expect(pageSource).toContain("${player.baseUrl}/demo");
    expect(pageSource).toContain('tabIndex={-1}');
  });

  it("keeps the preview and equal primary actions in one shared-width composition", () => {
    expect(pageSource).toContain('className={styles.content}');
  });
});
