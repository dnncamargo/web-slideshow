import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";
import { build as viteBuild } from "vite";

const brandingEntry = fileURLToPath(new URL("./fixtures/branding-runtime-entry.ts", import.meta.url));
const playerRoot = fileURLToPath(new URL("..", import.meta.url));

async function executeBundledDisplayName(configuredDisplayName: string): Promise<unknown> {
  const result = await viteBuild({
    configFile: false,
    root: playerRoot,
    define: {
      "process.env.WEB_SLIDESHOW_DISPLAY_NAME": JSON.stringify(configuredDisplayName),
    },
    logLevel: "silent",
    build: {
      write: false,
      rollupOptions: {
        input: brandingEntry,
      },
    },
  });

  const output = Array.isArray(result)
    ? result[0] && typeof result[0] === "object" && "output" in result[0]
      ? result[0].output
      : undefined
    : result && typeof result === "object" && "output" in result
      ? result.output
      : undefined;
  const chunk = Array.isArray(output) ? output.find((entry) => entry.type === "chunk") : undefined;
  if (!chunk || !("code" in chunk) || typeof chunk.code !== "string") {
    throw new Error("Vite did not produce a JavaScript chunk for the branding entry.");
  }

  const browserGlobal: Record<string, unknown> = {};
  runInNewContext(chunk.code, browserGlobal);
  return browserGlobal.__instanceDisplayName;
}

describe("Player browser-runtime instance branding", () => {
  it("keeps the configured display name when browser JavaScript has no process global", async () => {
    await expect(executeBundledDisplayName("Example Name")).resolves.toBe("Example Name");
  });

  it("keeps the neutral fallback when no display name is configured", async () => {
    await expect(executeBundledDisplayName("Presentation")).resolves.toBe("Presentation");
  });

  it("passes special characters to runtime branding as plain text", async () => {
    await expect(executeBundledDisplayName("A & B <Demo>")).resolves.toBe("A & B <Demo>");
  });
});
