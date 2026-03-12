import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import pc from "picocolors";

import { log } from "@clack/prompts";
import { defaultWrittenConfig } from "@changesets/config";

const require = createRequire(import.meta.url);

const pkgPath = path.dirname(require.resolve("@changesets/cli/package.json"));

const defaultConfig = `${JSON.stringify(defaultWrittenConfig, null, 2)}\n`;

export default async function init(cwd: string) {
  const changesetBase = path.resolve(cwd, ".changeset");

  if (existsSync(changesetBase)) {
    if (!existsSync(path.join(changesetBase, "config.json"))) {
      log.success(
        `
It looks like you don't have a config file
The default config file will be written to ${pc.blue(".changeset/config.json")}
        `.trim(),
      );

      await fs.writeFile(
        path.resolve(changesetBase, "config.json"),
        defaultConfig,
      );
    } else {
      log.success(
        `It looks like you already have ${pc.green("Changesets")} initialized.\nYou should be able to run changeset commands no problems.`,
      );
    }
  } else {
    await fs.cp(path.resolve(pkgPath, "./default-files"), changesetBase, {
      recursive: true,
    });
    await fs.writeFile(
      path.resolve(changesetBase, "config.json"),
      defaultConfig,
    );

    log.success(
      `
Thanks for choosing ${pc.green("Changesets")} to help manage your versioning and publishing.
You should be set up to start using changesets now!
We have created a \`.changeset\` folder, and a couple of files to help you out:
- ${pc.blue(".changeset/config.json")} with the default config options
- ${pc.blue(".changeset/README.md")} with information about using changesets
      `.trim(),
    );
  }
}
