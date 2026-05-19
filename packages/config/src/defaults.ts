import type { Config, WrittenConfig } from "@changesets/types";
import { parse } from "valibot";
// this requires that the package is built _after_ bumping versions before publishing
import manifest from "../package.json" with { type: "json" };
import { normalizeWrittenConfig, WrittenConfigSchema } from "./config.ts";

export const defaultWrittenConfig: WrittenConfig = {
  ["$schema" as never]: `https://unpkg.com/@changesets/config@${manifest.version}/schema.json`,
  access: "restricted",
};

let defaultConfig: Config | undefined;
export const getDefaultConfig = (): Config => {
  if (defaultConfig == null) {
    defaultConfig = {
      ...normalizeWrittenConfig({
        packageNames: [],
        writtenConfig: parse(WrittenConfigSchema, defaultWrittenConfig),
      }),
    };
  }

  return defaultConfig;
};
