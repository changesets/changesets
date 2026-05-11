import { defineConfig } from "tsdown/config";

const isCi = process.env.CI != null;

export const baseConfig = defineConfig({
  entry: "src/index.ts",
  outDir: "dist",
  exports: true,
  // useful for running `build --watch` and `test` concurrently
  clean: !process.argv.includes("--watch"),

  dts: { enabled: true, parallel: !isCi, sourcemap: !isCi },
  format: "esm",
  minify: "dce-only",
  platform: "node",

  checks: { pluginTimings: false },
  publint: true,
});

export default defineConfig({
  workspace: ["packages/*"],
});
