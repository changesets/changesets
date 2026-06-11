import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import c from "@changesets/color";
import { defaultWrittenConfig } from "@changesets/config";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import * as cli from "../../utils/cli-utilities.ts";

const pkgPath = path.dirname(
  fileURLToPath(import.meta.resolve("@changesets/cli/package.json")),
);

export interface InitOptions {
  cwd?: string;
}

export type AccessType = "public" | "restricted";

async function getInteractiveConfig() {
  const config = { ...defaultWrittenConfig };

  const changelogChoice = await cli.askList(
    "Which changelog entry generator should be used?",
    [
      {
        label: "Standard changelogs",
        value: "@changesets/cli/changelog",
      },
      {
        label: "Changelogs with GitHub info",
        value: "@changesets/changelog-github",
      },
      {
        label: "Changelogs with commit info",
        value: "@changesets/changelog-git",
      },
    ],
  );

  if (changelogChoice === "@changesets/changelog-github") {
    const repo = await cli.askQuestion(
      "What is the GitHub repository? (e.g. org/repo)",
      { placeholder: "org/repo", notEmpty: true },
    );
    config.changelog = [changelogChoice, { repo }];
  } else {
    config.changelog = changelogChoice;
  }

  config.commit = await cli.askConfirm(
    "Should changeset files and version bumps be automatically committed?",
    false,
  );

  config.access = (await cli.askList(
    "Should packages be published publicly or privately?",
    [
      { label: "Privately", value: "restricted" },
      { label: "Publicly", value: "public" },
    ],
  )) as AccessType | "private";

  const baseBranchInput = await cli.askQuestion(
    "Which base branch should be used?",
    { placeholder: "main" },
  );

  config.baseBranch = baseBranchInput || "main";

  return `${JSON.stringify(config, null, 2)}\n`;
}

export async function init(options?: InitOptions): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  const changesetBase = path.resolve(packages.rootDir, ".changeset");

  if (existsSync(changesetBase)) {
    if (!existsSync(path.join(changesetBase, "config.json"))) {
      log.info(
        `A new ${c.blue("Changeset")} configuration is being initialized...\n`,
      );

      const newConfigStr = await getInteractiveConfig();

      await fs.writeFile(
        path.resolve(changesetBase, "config.json"),
        newConfigStr,
      );

      if (!existsSync(path.join(changesetBase, "README.md"))) {
        await fs.copyFile(
          path.resolve(pkgPath, "./default-files/README.md"),
          path.resolve(changesetBase, "README.md"),
        );
      }

      log.success(
        `
${c.green("Changesets")} initialization is complete.
The ${c.blue(".changeset")} folder has been updated with:
- ${c.blue("config.json")} (customized based on the provided preferences)
- ${c.blue("README.md")} (a quick guide for using changesets)

Versioning and publishing can now be managed!
        `.trim(),
      );
    } else {
      log.success(
        `
${c.green("Changesets")} has already been initialized.
Changeset commands can be run with no problems.
        `.trim(),
      );
    }
  } else {
    await fs.cp(path.resolve(pkgPath, "./default-files"), changesetBase, {
      recursive: true,
    });

    const newConfigStr = await getInteractiveConfig();

    await fs.writeFile(
      path.resolve(changesetBase, "config.json"),
      newConfigStr,
    );

    log.success(
      `
${c.green("Changesets")} initialization is complete.
The ${c.blue(".changeset")} folder has been successfully created with:
- ${c.blue("config.json")} (customized based on the provided preferences)
- ${c.blue("README.md")} (a quick guide for using changesets)

Versioning and publishing can now be managed!
      `.trim(),
    );
  }
}
