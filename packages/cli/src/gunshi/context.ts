import fs from "node:fs";
import path from "node:path";
import { read } from "@changesets/config";
import type { Config, Packages } from "@changesets/types";
import { outro } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { type Args as GunshiArgs, type Command, define } from "gunshi";
import { plugin } from "gunshi/plugin";
import pc from "picocolors";

export type CustomExtensions = {
  config: Config;
  packages: Packages;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const packagesPlugin = plugin<{}, "packages", [], Packages>({
  id: "packages",
  extension: async ({ env }) => getPackages(env.cwd ?? process.cwd()),
});

export const configPlugin = plugin<
  Pick<CustomExtensions, "packages">,
  "config",
  ["packages"],
  Config
>({
  id: "config",
  dependencies: ["packages"],
  extension: async ({ extensions }) => {
    try {
      fs.accessSync(path.resolve(extensions.packages.rootDir, ".changeset"));
    } catch {
      outro(
        `
${pc.red(`There is no ${pc.cyan(".changeset")} folder.`)}
If this is the first time ${pc.green("Changesets")} have been used in this project, run ${pc.cyan("changeset init")} to get set up.

${pc.italic("If you expected there to be changesets, you should check git history for when the folder was removed\nto ensure you do not lose any configuration.")}
        `.trim(),
        { withGuide: false },
      );
      process.exit(1);
    }

    return read(extensions.packages.rootDir, extensions.packages);
  },
});

export const defineWithContext = <Args extends GunshiArgs>(
  ctx: Command<{
    args: Args;
    extensions: CustomExtensions;
  }>,
) => define(ctx);
