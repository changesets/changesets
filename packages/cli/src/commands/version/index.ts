import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyReleasePlan } from "@changesets/apply-release-plan";
import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import * as git from "@changesets/git";
import { readPreState } from "@changesets/pre";
import { readChangesets } from "@changesets/read";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type { Config, Packages } from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { getCommitFunctions } from "../../commit/getCommitFunctions.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";
import { readConfig } from "../../utils/read-config.ts";
import { ensureChangesetFolder } from "../shared.ts";

export interface VersionOptions {
  cwd?: string;
  ignore?: string[];
  snapshot?: string | boolean;
  snapshotPrereleaseTemplate?: string;
}

export async function version(options: VersionOptions) {
  const cwd = options.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);

  const messages: string[] = [];
  let ignore: readonly string[] | undefined;

  if (options.ignore != null) {
    if (config.ignore.length > 0) {
      messages.push(
        "It looks like you are trying to use the `--ignore` option while ignore is defined in the config file. This is currently not allowed, you can only use one of them at a time.",
      );
    } else {
      ignore = options.ignore;
    }
  }
  const releaseConfig = {
    ...config,
    ignore: ignore ?? config.ignore,
    snapshot: {
      ...config.snapshot,
      prereleaseTemplate:
        options.snapshotPrereleaseTemplate ??
        config.snapshot.prereleaseTemplate,
    },
    // Disable committing when in snapshot mode
    commit: options.snapshot ? false : config.commit,
  };

  validateIgnoredPackageNames(packages, options.ignore, messages);
  validateSkippedDependents(packages, releaseConfig, messages);

  if (messages.length > 0) {
    log.error(messages.join("\n"));
    throw new ExitError(1);
  }

  const [changesets, preState] = await Promise.all([
    readChangesets(cwd),
    readPreState(cwd),
  ]);

  if (preState?.mode === "pre") {
    if (options.snapshot != null) {
      log.error(
        `
Snapshot release is not allowed in pre mode.
To resolve this exit the pre mode by running ${c.cyan("changeset pre exit")}.
        `.trim(),
      );
      throw new ExitError(1);
    } else {
      importantWarning(
        `
You are in prerelease mode!
If you meant to do a normal release you should revert these changes and run ${c.cyan("changeset pre exit")}.
You can then run ${c.cyan("changeset version")} again to do a normal release.
        `,
      );
    }
  }

  if (
    changesets.length === 0 &&
    (preState == null || preState.mode !== "exit")
  ) {
    log.warn("No unreleased changesets found.");
    throw new ExitError(1);
  }

  const releasePlan = assembleReleasePlan(
    changesets,
    packages,
    releaseConfig,
    preState,
    options.snapshot
      ? {
          tag: options.snapshot === true ? undefined : options.snapshot,
          commit: releaseConfig.snapshot.prereleaseTemplate?.includes(
            "{commit}",
          )
            ? await git.getCurrentCommitId({ cwd })
            : undefined,
        }
      : undefined,
  );

  const contextDir = path.dirname(fileURLToPath(import.meta.url));

  const [...touchedFiles] = await applyReleasePlan(
    releasePlan,
    packages,
    releaseConfig,
    options.snapshot,
    contextDir,
  );

  const [{ getVersionMessage }, commitOpts] = await getCommitFunctions(
    releaseConfig.commit,
    cwd,
    contextDir,
  );
  if (getVersionMessage) {
    let touchedFile: string | undefined;
    // Note, git gets angry if you try and have two git actions running at once
    // So we need to be careful that these iterations are properly sequential
    while ((touchedFile = touchedFiles.shift())) {
      await git.add(path.relative(cwd, touchedFile), cwd);
    }

    const commit = await git.commit(
      await getVersionMessage(releasePlan, commitOpts),
      cwd,
    );

    if (!commit) {
      log.error("Changesets ran into trouble committing your files");
    } else {
      log.success(
        "All files have been updated and committed. You're ready to publish!",
      );
    }
  } else {
    log.success(
      "All files have been updated. Review them and commit at your leisure",
    );
  }
}

function validateIgnoredPackageNames(
  packages: Packages,
  ignoreFromCli: string[] | undefined,
  messages: string[],
) {
  if (!ignoreFromCli) {
    return;
  }
  const pkgNames = new Set(
    packages.packages.map(({ packageJson }) => packageJson.name),
  );

  for (const pkgName of ignoreFromCli) {
    if (pkgNames.has(pkgName)) {
      continue;
    }

    messages.push(
      `The package ${c.blue(pkgName)} is passed to the \`--ignore\` option but it is not found in the project. You may have misspelled the package name.`,
    );
  }
}

function validateSkippedDependents(
  packages: Packages,
  config: Config,
  messages: string[],
) {
  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );

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
          `The package ${c.blue(dependent)} depends on the skipped package ${c.blue(skippedPackage)} (either by \`ignore\` option or by \`privatePackages.version\`), but ${c.blue(dependent)} is not being skipped. Please pass ${c.blue(dependent)} to the ${c.cyan("--ignore")} flag.`,
        );
      }
    }
  }
}
