import { defineConfig } from "tsdown/config";
import { baseConfig } from "../../tsdown.config.ts";

export default defineConfig({
  ...baseConfig,
  exports: {
    customExports: {
      "./schema.json": "./schema.json",
    },
  },
});
