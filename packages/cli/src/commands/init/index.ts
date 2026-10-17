import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import c from "@changesets/color";
import { defaultWrittenConfig } from "@changesets/config";
import type { AccessType } from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { resolveCommand } from "package-manager-detector/commands";
import { detect } from "package-manager-detector/detect";
import { exec } from "tinyexec";
import * as cli from "../../utils/cli-utilities.ts";

const pkgPath = path.dirname(
  fileURLToPath(import.meta.resolve("@changesets/cli/package.json")),
);
const GITHUB_CHANGELOG_PACKAGE = "@changesets/changelog-github";

export interface InitOptions {
  cwd?: string;
}

async function getInteractiveConfig() {
  const config = { ...defaultWrittenConfig };

  const useGithub = await cli.askConfirm(
    "Should the GitHub integration be used for changelogs?",
    false,
  );

  if (useGithub) {
    const repo = await cli.askQuestion(
      "What is the GitHub repository? (e.g. org/repo)",
      { placeholder: "org/repo", notEmpty: true },
    );
    config.changelog = [GITHUB_CHANGELOG_PACKAGE, { repo }];
  } else {
    config.changelog = "@changesets/cli/changelog";
  }

  config.commit = await cli.askConfirm(
    "Should changeset files and version bumps be automatically committed?",
    false,
  );

  config.access = await cli.askList<AccessType>(
    "Should packages be published publicly or privately by default?",
    [
      { label: "Private", value: "restricted" },
      { label: "Public", value: "public" },
    ],
  );

  const baseBranchInput = await cli.askQuestion(
    "Which base branch should be used?",
    { placeholder: "main" },
  );

  config.baseBranch = baseBranchInput || "main";

  const priorityOrder = [
    "$schema",
    "baseBranch",
    "access",
    "format",
    "changelog",
    "commit",
    "ignore",
    "fixed",
    "linked",
    "updateInternalDependencies",
  ];

  const sortedConfig: Record<string, any> = {};

  for (const key of priorityOrder) {
    if (key in config) {
      sortedConfig[key] = (config as Record<string, any>)[key];
    }
  }

  for (const key of Object.keys(config)) {
    if (!(key in sortedConfig)) {
      sortedConfig[key] = (config as Record<string, any>)[key];
    }
  }

  return {
    config: `${JSON.stringify(sortedConfig, null, 2)}\n`,
    useGithub,
  };
}

async function installGithubChangelog(cwd: string): Promise<boolean> {
  const packageManager = await detect({ cwd });
  if (
    !packageManager ||
    !["npm", "pnpm", "yarn", "bun"].includes(packageManager.name)
  ) {
    return false;
  }

  const devFlag = packageManager.name === "bun" ? "--dev" : "-D";
  const command = resolveCommand(packageManager.agent, "add", [
    devFlag,
    GITHUB_CHANGELOG_PACKAGE,
  ]);
  if (!command) {
    return false;
  }

  await exec(command.command, command.args, {
    nodePath: false,
    nodeOptions: { cwd, stdio: "inherit" },
  });

  return true;
}

export async function init(options?: InitOptions): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  const changesetBase = path.resolve(packages.rootDir, ".changeset");

  if (existsSync(path.join(changesetBase, "config.json"))) {
    log.success(
      `
${c.green("Changesets")} has already been initialized.
Changeset commands can be run with no problems.
      `.trim(),
    );
    return;
  }

  log.info(
    `A new ${c.blue("Changeset")} configuration is being initialized...\n`,
  );

  if (!existsSync(changesetBase)) {
    await fs.mkdir(changesetBase, { recursive: true });
  }

  const { config: newConfigStr, useGithub } = await getInteractiveConfig();
  let githubPackageInstalled = false;

  if (useGithub) {
    const shouldInstall = await cli.askConfirm(
      `Install ${GITHUB_CHANGELOG_PACKAGE} as a development dependency?`,
      true,
    );
    if (shouldInstall) {
      try {
        githubPackageInstalled = await installGithubChangelog(packages.rootDir);
      } catch {
        githubPackageInstalled = false;
      }
      if (!githubPackageInstalled) {
        log.info(
          `Install ${GITHUB_CHANGELOG_PACKAGE} with your package manager before creating releases.`,
        );
      }
    } else {
      log.info(
        `Install ${GITHUB_CHANGELOG_PACKAGE} with your package manager before creating releases.`,
      );
    }
  }

  await fs.writeFile(path.resolve(changesetBase, "config.json"), newConfigStr);

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
${githubPackageInstalled ? `- ${c.blue(GITHUB_CHANGELOG_PACKAGE)} (development dependency)` : ""}
    `.trim(),
  );
}
