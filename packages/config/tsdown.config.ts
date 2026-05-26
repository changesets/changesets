import type { Config } from "@changesets/types";
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
  define: {
    "globalThis.__CHANGESETS_DEFAULT_CONFIG__": JSON.stringify(
      await getDefaultConfig(),
    ),
  },
});

async function getDefaultConfig(): Promise<Config> {
  const { parse } = await import("valibot");
  const { defaultWrittenConfig } = await import("./src/defaults.ts");
  const { normalizeWrittenConfig, WrittenConfigSchema } =
    await import("./src/config.ts");

  return normalizeWrittenConfig({
    packageNames: [],
    writtenConfig: parse(WrittenConfigSchema, defaultWrittenConfig),
  });
}
