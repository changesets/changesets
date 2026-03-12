import pc from "picocolors";
import { read } from "@changesets/config";
import { ExitError } from "@changesets/errors";
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type { Config } from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import fs from "node:fs/promises";
import path from "path";
import add from "./commands/add/index.ts";
import init from "./commands/init/index.ts";
import pre from "./commands/pre/index.ts";
import publish from "./commands/publish/index.ts";
import status from "./commands/status/index.ts";
import tagCommand from "./commands/tag/index.ts";
import version from "./commands/version/index.ts";
import { COMMAND_HELP } from "./help.ts";
import type { CliOptions } from "./types.ts";

function validateCommandFlags(
  command: keyof typeof COMMAND_HELP,
  flags: Record<string, unknown>,
) {
  const unknownFlags = Object.keys(flags);

  if (unknownFlags.length > 0) {
    error(
      `Unknown ${
        unknownFlags.length === 1 ? "flag" : "flags"
      } for ${command}: ${unknownFlags.map((flag) => `--${flag}`).join(", ")}`,
    );
    error(`Usage: changeset ${COMMAND_HELP[command]}`);
    throw new ExitError(1);
  }
}

export async function run(
  input: string[],
  flags: { [name: string]: any },
  cwd: string,
) {
  const packages = await getPackages(cwd);

  if (input[0] === "init") {
    validateCommandFlags("init", flags);
    await init(packages.rootDir);
    return;
  }

  try {
    await fs.access(path.resolve(packages.rootDir, ".changeset"));
  } catch (err) {
    log.error(
      `
There is no .changeset folder.
If this is the first time ${pc.green("Changesets")} have been used in this project, run ${pc.cyan("changeset init")} to get set up.
If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration.
      `.trim(),
    );
    throw new ExitError(1);
  }

  let config: Config;
  try {
    config = await read(packages.rootDir, packages);
  } catch (e) {
    let oldConfigExists = await fs
      .access(path.resolve(packages.rootDir, ".changeset/config.js"))
      .then(
        () => true,
        () => false,
      );
    if (oldConfigExists) {
      log.error(
        `
It looks like you're using the version 1 ${pc.blue(".changeset/config.js")} file.
You'll need to convert it to ${pc.blue(".changeset/config.json")}, and update the
config as the options have significantly changed as well in v2.
We thoroughly recommend looking at the changelog for this package for what has changed.
Changesets will create a new file with default options, remember to migrate your old config to it:
${pc.blue(".changeset/config.json")}
          `.trim(),
      );
      throw new ExitError(1);
    } else {
      throw e;
    }
  }

  if (input.length < 1) {
    const { empty, open, since, message, ...rest }: CliOptions = flags;
    validateCommandFlags("add", rest);
    await add(packages.rootDir, { empty, open, since, message }, config);
  } else if (input[0] !== "pre" && input.length > 1) {
    log.error(
      "Too many arguments passed to changesets - we only accept the command name as an argument",
    );
  } else {
    // Command line options need to be undefined, otherwise their
    // default value overrides the user's provided config in their
    // config file. For this reason, we only assign them to this
    // object as and when they exist.

    switch (input[0]) {
      case "add": {
        const { empty, open, since, message, ...rest }: CliOptions = flags;
        validateCommandFlags("add", rest);
        await add(packages.rootDir, { empty, open, since, message }, config);
        return;
      }
      case "version": {
        const {
          ignore,
          snapshot,
          snapshotPrereleaseTemplate,
          ...rest
        }: CliOptions = flags;
        validateCommandFlags("version", rest);
        let ignoreArrayFromCmd: undefined | string[];
        if (typeof ignore === "string") {
          ignoreArrayFromCmd = [ignore];
        } else {
          // undefined or an array
          ignoreArrayFromCmd = ignore;
        }

        // Validate that items in ignoreArrayFromCmd are valid project names
        let pkgNames = new Set(
          packages.packages.map(({ packageJson }) => packageJson.name),
        );

        const messages = [];
        for (const pkgName of ignoreArrayFromCmd || []) {
          if (!pkgNames.has(pkgName)) {
            messages.push(
              `The package ${pc.blue(pkgName)} is passed to the \`--ignore\` option but it is not found in the project. You may have misspelled the package name.`,
            );
          }
        }

        if (config.ignore.length > 0 && ignoreArrayFromCmd) {
          messages.push(
            `It looks like you are trying to use the \`--ignore\` option while ignore is defined in the config file. This is currently not allowed, you can only use one of them at a time.`,
          );
        } else if (ignoreArrayFromCmd) {
          // use the ignore flags from cli
          config.ignore = ignoreArrayFromCmd;
        }

        const packagesByName = new Map(
          packages.packages.map((x) => [x.packageJson.name, x]),
        );

        // Validate that all dependents of skipped packages are also skipped.
        // devDependencies are excluded because they don't affect published consumers —
        // a stale devDep range on a skipped package is harmless.
        // Note: assemble-release-plan uses a graph WITH devDeps because it needs to
        // update devDep ranges in package.json even though they don't cause version bumps.
        const dependentsGraph = getDependentsGraph(packages, {
          ignoreDevDependencies: true,
          bumpVersionsWithWorkspaceProtocolOnly:
            config.bumpVersionsWithWorkspaceProtocolOnly,
        });
        for (const pkg of packages.packages) {
          if (
            !shouldSkipPackage(pkg, {
              ignore: config.ignore,
              allowPrivatePackages: config.privatePackages.version,
            })
          ) {
            continue;
          }
          const skippedPackage = pkg.packageJson.name;
          const dependents = dependentsGraph.get(skippedPackage) || [];
          for (const dependent of dependents) {
            const dependentPkg = packagesByName.get(dependent)!;
            if (dependentPkg.packageJson.private) {
              // Private packages don't publish to npm,
              // so they can safely depend on skipped packages.
              // This also holds for private packages with other publish targets (like a VS Code extension)
              // as those typically have to prebundle dependencies.
              continue;
            }
            if (
              !shouldSkipPackage(dependentPkg, {
                ignore: config.ignore,
                allowPrivatePackages: config.privatePackages.version,
              })
            ) {
              messages.push(
                `The package ${pc.blue(dependent)} depends on the skipped package ${pc.blue(skippedPackage)} (either by \`ignore\` option or by \`privatePackages.version\`), but ${pc.blue(dependent)} is not being skipped. Please pass ${pc.blue(dependent)} to the ${pc.cyan("--ignore")} flag.`,
              );
            }
          }
        }

        if (messages.length > 0) {
          log.error(messages.join("\n"));

          throw new ExitError(1);
        }

        if (snapshotPrereleaseTemplate) {
          config.snapshot.prereleaseTemplate = snapshotPrereleaseTemplate;
        }

        await version(packages.rootDir, { snapshot }, config);
        return;
      }
      case "publish": {
        const { otp, tag, gitTag, ...rest }: CliOptions = flags;
        validateCommandFlags("publish", rest);
        await publish(packages.rootDir, { otp, tag, gitTag }, config);
        return;
      }
      case "status": {
        const { since, verbose, output, ...rest }: CliOptions = flags;
        validateCommandFlags("status", rest);
        await status(packages.rootDir, { since, verbose, output }, config);
        return;
      }
      case "tag": {
        validateCommandFlags("tag", flags);
        await tagCommand(packages.rootDir, config);
        return;
      }
      case "pre": {
        validateCommandFlags("pre", flags);
        let command = input[1];
        if (command !== "enter" && command !== "exit") {
          log.error(
            `${pc.cyan("enter")}, ${pc.cyan("exit")} or ${pc.cyan("snapshot")} must be passed after prerelease`,
          );
          throw new ExitError(1);
        }
        let tag = input[2];
        if (command === "enter" && typeof tag !== "string") {
          log.error(`A tag must be passed when using prerelease enter`);
          throw new ExitError(1);
        }
        await pre(packages.rootDir, { command, tag });
        return;
      }
      case "bump": {
        log.error(
          `
In version 2 of changesets, ${pc.red("bump")} has been renamed to ${pc.cyan("version")} - see our changelog for an explanation
To fix this, use ${pc.cyan("changeset version")} instead, and update any scripts that use changesets
          `.trim(),
        );
        throw new ExitError(1);
      }
      case "release": {
        log.error(
          `
In version 2 of changesets, ${pc.red("release")} has been renamed to ${pc.cyan("publish")} - see our changelog for an explanation
To fix this, use ${pc.cyan("changeset publish")} instead, and update any scripts that use changesets
          `.trim(),
        );
        throw new ExitError(1);
      }
      default: {
        log.error(`Unknown command: ${pc.red(input[0])}`);
        throw new ExitError(1);
      }
    }
  }
}
