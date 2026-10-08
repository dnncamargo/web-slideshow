import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["tests/setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "tests/firestore-rules-emulator.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
