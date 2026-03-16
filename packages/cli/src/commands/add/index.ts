import pc from "picocolors";
import { spawn } from "child_process";
import path from "path";

import * as git from "@changesets/git";
import { error, info, log, warn } from "@changesets/logger";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import { Config, Release, VersionType } from "@changesets/types";
import writeChangeset from "@changesets/write";
import { ExitError } from "@changesets/errors";
import { getPackages } from "@manypkg/get-packages";
import { ExternalEditor } from "@inquirer/external-editor";
import { getCommitFunctions } from "../../commit/getCommitFunctions";
import * as cli from "../../utils/cli-utilities";
import { getVersionableChangedPackages } from "../../utils/versionablePackages";
import createChangeset from "./createChangeset";
import printConfirmationMessage from "./messages";

export default async function add(
  cwd: string,
  {
    empty,
    open,
    since,
    message,
    packages: pkgFlags,
    type: defaultType,
    all,
  }: {
    empty?: boolean;
    open?: boolean;
    since?: string;
    message?: string;
    packages?: string | string[];
    type?: string;
    all?: boolean;
  },
  config: Config
): Promise<void> {
  const packages = await getPackages(cwd);
  if (packages.packages.length === 0) {
    error(
      `No packages found. You might have ${packages.tool} workspaces configured but no packages yet?`
    );
    throw new ExitError(1);
  }

  const versionablePackages = packages.packages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      })
  );

  if (versionablePackages.length === 0) {
    error("No versionable packages found");
    error('- Ensure the packages to version are not in the "ignore" config');
    error('- Ensure that relevant package.json files have the "version" field');
    throw new ExitError(1);
  }

  const changesetBase = path.resolve(cwd, ".changeset");

  // Normalize --packages to an array
  const packagesList: string[] | undefined = pkgFlags
    ? Array.isArray(pkgFlags)
      ? pkgFlags
      : [pkgFlags]
    : undefined;

  // Check if we have enough info for non-interactive mode
  const hasPackageSelection = all || (packagesList && packagesList.length > 0);
  const hasMessage = message !== undefined;
  const isNonInteractive = hasPackageSelection && hasMessage && !empty;

  let newChangeset: Awaited<ReturnType<typeof createChangeset>>;
  if (empty) {
    newChangeset = {
      confirmed: true,
      releases: [],
      summary: message ?? "",
    };
  } else if (isNonInteractive) {
    newChangeset = await buildNonInteractiveChangeset({
      packagesList,
      defaultType,
      all,
      since,
      message: message!,
      versionablePackages,
      config,
      cwd,
    });
  } else {
    let changedPackagesNames: string[] = [];
    try {
      changedPackagesNames = (
        await getVersionableChangedPackages(config, {
          cwd,
          ref: since,
        })
      ).map((pkg) => pkg.packageJson.name);
    } catch (e: any) {
      // NOTE: Getting the changed packages is best effort as it's only being used for easier selection
      // in the CLI. So if any error happens while we try to do so, we only log a warning and continue
      const branch = since ?? config.baseBranch;
      warn(
        `Failed to find changed packages from the "${branch}" ${
          since ? "ref" : "base branch"
        } due to error below`
      );
      warn(e);
    }

    newChangeset = await createChangeset(
      changedPackagesNames,
      versionablePackages,
      message
    );
    printConfirmationMessage(newChangeset, versionablePackages.length > 1);

    if (!newChangeset.confirmed) {
      newChangeset = {
        ...newChangeset,
        confirmed: await cli.askConfirm("Is this your desired changeset?"),
      };
    }
  }

  if (newChangeset.confirmed) {
    const changesetID = await writeChangeset(newChangeset, cwd, config);
    const [{ getAddMessage }, commitOpts] = await getCommitFunctions(
      config.commit,
      cwd
    );
    if (getAddMessage) {
      await git.add(path.resolve(changesetBase, `${changesetID}.md`), cwd);
      await git.commit(await getAddMessage(newChangeset, commitOpts), cwd);
      log(pc.green(`${empty ? "Empty " : ""}Changeset added and committed`));
    } else {
      log(
        pc.green(
          `${empty ? "Empty " : ""}Changeset added! - you can now commit it\n`
        )
      );
    }

    let hasMajorChange = [...newChangeset.releases].find(
      (c) => c.type === "major"
    );

    if (hasMajorChange) {
      warn(
        "This Changeset includes a major change and we STRONGLY recommend adding more information to the changeset:"
      );
      warn("WHAT the breaking change is");
      warn("WHY the change was made");
      warn("HOW a consumer should update their code");
    } else {
      log(
        pc.green(
          "If you want to modify or expand on the changeset summary, you can find it here"
        )
      );
    }
    const changesetPath = path.resolve(changesetBase, `${changesetID}.md`);
    info(pc.blue(changesetPath));

    if (open) {
      // this is really a hack to reuse the logic embedded in `external-editor` related to determining the editor
      const externalEditor = new ExternalEditor();
      externalEditor.cleanup();
      spawn(
        externalEditor.editor.bin,
        externalEditor.editor.args.concat([changesetPath]),
        {
          detached: true,
          stdio: "inherit",
        }
      );
    }
  }
}

const validBumpTypes = new Set<string>(["patch", "minor", "major"]);

function parsePackageFlag(
  flag: string,
  defaultType: string | undefined
): { name: string; type: VersionType } {
  const colonIndex = flag.lastIndexOf(":");
  if (colonIndex !== -1) {
    const name = flag.slice(0, colonIndex);
    const type = flag.slice(colonIndex + 1);
    if (!validBumpTypes.has(type)) {
      error(
        `Invalid bump type "${type}" for package "${name}". Must be one of: patch, minor, major`
      );
      throw new ExitError(1);
    }
    return { name, type: type as VersionType };
  }

  if (!defaultType) {
    error(
      `No bump type specified for package "${flag}". Use --type or specify inline as "${flag}:patch"`
    );
    throw new ExitError(1);
  }
  if (!validBumpTypes.has(defaultType)) {
    error(
      `Invalid bump type "${defaultType}". Must be one of: patch, minor, major`
    );
    throw new ExitError(1);
  }
  return { name: flag, type: defaultType as VersionType };
}

async function buildNonInteractiveChangeset({
  packagesList,
  defaultType,
  all,
  since,
  message,
  versionablePackages,
  config,
  cwd,
}: {
  packagesList: string[] | undefined;
  defaultType: string | undefined;
  all?: boolean;
  since?: string;
  message: string;
  versionablePackages: Awaited<ReturnType<typeof getPackages>>["packages"];
  config: Config;
  cwd: string;
}): Promise<{ confirmed: boolean; summary: string; releases: Release[] }> {
  const versionableNames = new Set(
    versionablePackages.map((pkg) => pkg.packageJson.name)
  );

  const releases: Release[] = [];

  // Collect explicit --packages flags with their overrides
  const explicitOverrides = new Map<string, VersionType>();
  if (packagesList) {
    for (const flag of packagesList) {
      const parsed = parsePackageFlag(flag, defaultType);
      if (!versionableNames.has(parsed.name)) {
        error(
          `The package "${parsed.name}" was not found in the project. ` +
            `Available packages: ${[...versionableNames].join(", ")}`
        );
        throw new ExitError(1);
      }
      explicitOverrides.set(parsed.name, parsed.type);
    }
  }

  if (all) {
    // Resolve all changed packages
    const changedPackages = await getVersionableChangedPackages(config, {
      cwd,
      ref: since,
    });

    if (changedPackages.length === 0) {
      error("No changed packages found");
      throw new ExitError(1);
    }

    for (const pkg of changedPackages) {
      const name = pkg.packageJson.name;
      const override = explicitOverrides.get(name);
      if (override) {
        releases.push({ name, type: override });
        explicitOverrides.delete(name);
      } else {
        if (!defaultType) {
          error(
            `--type is required when using --all without specifying a bump type for each package via --packages name:type`
          );
          throw new ExitError(1);
        }
        if (!validBumpTypes.has(defaultType)) {
          error(
            `Invalid bump type "${defaultType}". Must be one of: patch, minor, major`
          );
          throw new ExitError(1);
        }
        releases.push({ name, type: defaultType as VersionType });
      }
    }

    // Add any explicit overrides for packages not in the changed set
    // (user explicitly requested them)
    for (const [name, type] of explicitOverrides) {
      releases.push({ name, type });
    }
  } else {
    // Only explicit packages
    for (const [name, type] of explicitOverrides) {
      releases.push({ name, type });
    }
  }

  if (releases.length === 0) {
    error("No packages to release");
    throw new ExitError(1);
  }

  printConfirmationMessage(
    { releases, summary: message },
    versionablePackages.length > 1
  );

  return {
    confirmed: true,
    summary: message,
    releases,
  };
}
