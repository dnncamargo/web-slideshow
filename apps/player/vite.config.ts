import { defineConfig } from "vite";
import { readInstanceDisplayName } from "../../tools/instance-config.mjs";

export default defineConfig({
  define: {
    "process.env.WEB_SLIDESHOW_DISPLAY_NAME": JSON.stringify(readInstanceDisplayName()),
  },
});
