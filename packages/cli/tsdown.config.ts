import { defineConfig } from "tsdown/config";
import { baseConfig } from "../../tsdown.config.ts";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.ts", "src/changelog.ts", "src/commit/index.ts"],
  exports: {
    customExports: {
      "./bin.js": "./bin.js",
    },
  },
});
