import type { Config, WrittenConfig } from "@changesets/types";
// this requires that the package is built _after_ bumping versions before publishing
import manifest from "../package.json" with { type: "json" };

export const defaultWrittenConfig: WrittenConfig = {
  ["$schema" as never]: `https://unpkg.com/@changesets/config@${manifest.version}/schema.json`,
  baseBranch: "main",
  access: "restricted",
  ignore: [],
  fixed: [],
  linked: [],
  format: "auto",
  updateInternalDependencies: "patch",
  commit: false,
  changelog: "@changesets/cli/changelog",
};

// Replaced by tsdown
declare global {
  var __CHANGESETS_DEFAULT_CONFIG__: Config;
}
export const defaultConfig: Config = globalThis.__CHANGESETS_DEFAULT_CONFIG__;
