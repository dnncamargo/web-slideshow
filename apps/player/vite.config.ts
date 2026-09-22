import { defineConfig, type Plugin } from "vite";
import { readInstanceDisplayName } from "../../tools/instance-config.mjs";
import { transformPlayerIndexHtml } from "./src/index-html-title.ts";

export function playerIndexHtmlPlugin(displayName: string): Plugin {
  return {
    name: "player-instance-html-title",
    transformIndexHtml(html) {
      return transformPlayerIndexHtml(html, displayName);
    },
  };
}

export function createPlayerViteConfig(displayName: string) {
  return {
    define: {
      "process.env.WEB_SLIDESHOW_DISPLAY_NAME": JSON.stringify(displayName),
    },
    plugins: [playerIndexHtmlPlugin(displayName)],
  };
}

export default defineConfig(() => {
  const displayName = readInstanceDisplayName();
  return createPlayerViteConfig(displayName);
});
