import { read } from "@changesets/config";
import { ExitError } from "@changesets/errors";
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { error } from "@changesets/logger";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type { Config } from "@changesets/types";
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
import type { CliOptions } from "./types.ts";

export async function run(
  input: string[],
  flags: { [name: string]: any },
  cwd: string
) {
  const packages = await getPackages(cwd);
  const rootDir = packages.root.dir;

  if (input[0] === "init") {
    await init(rootDir);
    return;
  }

  try {
    await fs.access(path.resolve(rootDir, ".changeset"));
  } catch (err) {
    error("There is no .changeset folder. ");
    error(
      "If this is the first time `changesets` have been used in this project, run `yarn changeset init` to get set up."
    );
    error(
      "If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration."
    );
    throw new ExitError(1);
  }

  let config: Config;
  try {
    config = await read(rootDir, packages);
  } catch (e) {
    let oldConfigExists = await fs
      .access(path.resolve(rootDir, ".changeset/config.js"))
      .then(
        () => true,
        () => false
      );
    if (oldConfigExists) {
      error(
        "It looks like you're using the version 1 `.changeset/config.js` file"
      );
      error("You'll need to convert it to a `.changeset/config.json` file");
      error(
        "The format of the config object has significantly changed in v2 as well"
      );
      error(
        " - we thoroughly recommend looking at the changelog for this package for what has changed"
      );
      throw new ExitError(1);
    } else {
      throw e;
    }
  }

  if (input.length < 1) {
    const { empty, open, since, message }: CliOptions = flags;
    // @ts-ignore if this is undefined, we have already exited
    await add(rootDir, { empty, open, since, message }, config);
  } else if (input[0] !== "pre" && input.length > 1) {
    error(
      "Too many arguments passed to changesets - we only accept the command name as an argument"
    );
  } else {
    const {
      since,
      verbose,
      output,
      otp,
      empty,
      ignore,
      snapshot,
      snapshotPrereleaseTemplate,
      tag,
      open,
      gitTag,
      message,
    }: CliOptions = flags;
    // Command line options need to be undefined, otherwise their
    // default value overrides the user's provided config in their
    // config file. For this reason, we only assign them to this
    // object as and when they exist.

    switch (input[0]) {
      case "add": {
        await add(rootDir, { empty, open, since, message }, config);
        return;
      }
      case "version": {
        let ignoreArrayFromCmd: undefined | string[];
        if (typeof ignore === "string") {
          ignoreArrayFromCmd = [ignore];
        } else {
          // undefined or an array
          ignoreArrayFromCmd = ignore;
        }

        // Validate that items in ignoreArrayFromCmd are valid project names
        let pkgNames = new Set(
          packages.packages.map(({ packageJson }) => packageJson.name)
        );

        const messages = [];
        for (const pkgName of ignoreArrayFromCmd || []) {
          if (!pkgNames.has(pkgName)) {
            messages.push(
              `The package "${pkgName}" is passed to the \`--ignore\` option but it is not found in the project. You may have misspelled the package name.`
            );
          }
        }

        if (config.ignore.length > 0 && ignoreArrayFromCmd) {
          messages.push(
            `It looks like you are trying to use the \`--ignore\` option while ignore is defined in the config file. This is currently not allowed, you can only use one of them at a time.`
          );
        } else if (ignoreArrayFromCmd) {
          // use the ignore flags from cli
          config.ignore = ignoreArrayFromCmd;
        }

        const packagesByName = new Map(
          packages.packages.map((x) => [x.packageJson.name, x])
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
                `The package "${dependent}" depends on the skipped package "${skippedPackage}" (either by \`ignore\` option or by \`privatePackages.version\`), but "${dependent}" is not being skipped. Please pass "${dependent}" to the \`--ignore\` flag.`
              );
            }
          }
        }

        if (messages.length > 0) {
          error(messages.join("\n"));

          throw new ExitError(1);
        }

        if (snapshotPrereleaseTemplate) {
          config.snapshot.prereleaseTemplate = snapshotPrereleaseTemplate;
        }

        await version(rootDir, { snapshot }, config);
        return;
      }
      case "publish": {
        await publish(rootDir, { otp, tag, gitTag }, config);
        return;
      }
      case "status": {
        await status(rootDir, { since, verbose, output }, config);
        return;
      }
      case "tag": {
        await tagCommand(rootDir, config);
        return;
      }
      case "pre": {
        let command = input[1];
        if (command !== "enter" && command !== "exit") {
          error(
            "`enter`, `exit` or `snapshot` must be passed after prerelease"
          );
          throw new ExitError(1);
        }
        let tag = input[2];
        if (command === "enter" && typeof tag !== "string") {
          error(`A tag must be passed when using prerelease enter`);
          throw new ExitError(1);
        }
        await pre(rootDir, { command, tag });
        return;
      }
      case "bump": {
        error(
          'In version 2 of changesets, "bump" has been renamed to "version" - see our changelog for an explanation'
        );
        error(
          "To fix this, use `changeset version` instead, and update any scripts that use changesets"
        );
        throw new ExitError(1);
      }
      case "release": {
        error(
          'In version 2 of changesets, "release" has been renamed to "publish" - see our changelog for an explanation'
        );
        error(
          "To fix this, use `changeset publish` instead, and update any scripts that use changesets"
        );
        throw new ExitError(1);
      }
      default: {
        error(`Invalid command ${input[0]} was provided`);
        throw new ExitError(1);
      }
    }
  }
}
