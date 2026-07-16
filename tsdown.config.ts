import { defineConfig } from "tsdown/config";

const isCi = process.env.CI != null;

export const baseConfig = defineConfig({
  entry: "src/index.ts",
  outDir: "dist",
  hash: false,
  exports: true,
  // useful for running `build --watch` and `test` concurrently
  clean: !process.argv.includes("--watch"),
  deps: {
    onlyBundle: [], // require explicitly listing inlined dependencies
  },

  env: {
    CHANGESETS_FAKE_PUBLISH: process.env.CHANGESETS_FAKE_PUBLISH ? true : null,
  },

  sourcemap: !isCi,
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
