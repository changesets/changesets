import { defineConfig } from "tsdown/config";

export const baseConfig = defineConfig({
  entry: "src/index.ts",
  outDir: "dist",

  dts: true,
  format: "esm",
  minify: "dce-only",
});

export default defineConfig({
  workspace: ["packages/*", "scripts/*"],
});
