import { defineConfig } from "tsdown/config";

export const baseConfig = defineConfig({
  entry: "src/index.ts",
  outDir: "dist",
  exports: true,

  dts: { parallel: !process.env.CI },
  format: "esm",
  minify: "dce-only",
  platform: "node",

  checks: { pluginTimings: false },
  publint: true,
});

export default defineConfig({
  workspace: ["packages/*"],
});
