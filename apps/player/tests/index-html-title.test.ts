import { describe, expect, it } from "vitest";

import indexHtml from "../index.html?raw";
import mainSource from "../src/main.ts?raw";
import viteConfigSource from "../vite.config.ts?raw";
import { transformPlayerIndexHtml } from "../src/index-html-title";

describe("Player instance HTML title", () => {
  it("uses the resolved configured display name", () => {
    expect(transformPlayerIndexHtml(indexHtml, "Example Name")).toContain(
      "<title>Example Name Player</title>",
    );
  });

  it("keeps the neutral fallback title", () => {
    expect(transformPlayerIndexHtml(indexHtml, "Presentation")).toContain(
      "<title>Presentation Player</title>",
    );
  });

  it("escapes HTML characters in the human display name", () => {
    const html = transformPlayerIndexHtml(indexHtml, "A & B <Demo> $&");

    expect(html).toContain("<title>A &amp; B &lt;Demo&gt; $&amp; Player</title>");
    expect(html).not.toContain("<title>A & B <Demo> $& Player</title>");
  });

  it("keeps runtime branding on the same display name contract", () => {
    expect(mainSource).toContain("document.title = `${displayName} Player`;");
  });

  it("wires the same resolved display name into Vite HTML transformation", () => {
    expect(viteConfigSource).toContain("const displayName = readInstanceDisplayName();");
    expect(viteConfigSource).toContain("return createPlayerViteConfig(displayName);");
    expect(viteConfigSource).toContain("transformPlayerIndexHtml(html, displayName)");
  });
});
