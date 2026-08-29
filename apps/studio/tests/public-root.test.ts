import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import pageSource from "../src/app/page.tsx?raw";

const stylesSource = readFileSync(
  fileURLToPath(new URL("../src/app/page.module.css", import.meta.url)),
  "utf8",
);

describe("public root", () => {
  it("offers PowerShow, Studio, and Player without the old idle copy", () => {
    expect(pageSource).toContain("PowerShow");
    expect(pageSource).toContain("Studio");
    expect(pageSource).toContain("Player");
    expect(pageSource).not.toContain("public.library");
    expect(pageSource).not.toContain("public.play");
    expect(pageSource).not.toContain("public.noLive");
  });

  it("uses the configured Player demo as a full-screen, visual-only background", () => {
    expect(pageSource).toContain("${player.baseUrl}/demo");
    expect(pageSource).toContain('tabIndex={-1}');
    expect(pageSource).toContain('className={styles.background}');
    expect(pageSource).toContain('className={styles.overlay}');
    expect(stylesSource).toContain("width: max(100vw, calc(100dvh * 16 / 9))");
    expect(stylesSource).not.toContain(".presentation");
  });

  it("gives Studio and Player distinct square action classes", () => {
    expect(pageSource).toContain("styles.studioAction");
    expect(pageSource).toContain("styles.playerAction");
    expect(stylesSource).toContain("border-radius: 0");
    expect(stylesSource).not.toContain(".content");
  });
});
