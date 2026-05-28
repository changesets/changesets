import { comptime } from "comptime/rolldown";
import { defineConfig } from "tsdown/config";
import { baseConfig } from "../../tsdown.config.ts";

export default defineConfig({
  ...baseConfig,
  deps: {
    onlyBundle: ["valibot"],
  },
  exports: {
    customExports: {
      "./schema.json": "./schema.json",
    },
  },
  plugins: [comptime()],
});
