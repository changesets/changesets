import pc from "picocolors";
import { spawn } from "child_process";
import path from "path";

import * as git from "@changesets/git";
import { error, info, log, warn } from "@changesets/logger";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import { Config, VersionType } from "@changesets/types";
import writeChangeset from "@changesets/write";
import { ExitError } from "@changesets/errors";
import { getPackages } from "@manypkg/get-packages";
import { ExternalEditor } from "@inquirer/external-editor";
import { getCommitFunctions } from "../../commit/getCommitFunctions";
import * as cli from "../../utils/cli-utilities";
import { getVersionableChangedPackages } from "../../utils/versionablePackages";
import createChangeset from "./createChangeset";
import printConfirmationMessage from "./messages";
import { getRecommendedBump } from "./auto-mode";

// Types for auto mode functionality
export type AutoModeRelease = {
  name: string;
  type: VersionType;
};

export default async function add(
  cwd: string,
  { empty, open, auto }: { empty?: boolean; open?: boolean; auto?: boolean },
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
        ignore: config.ignore || [],
        allowPrivatePackages: config.privatePackages?.version || false,
      })
  );

  if (versionablePackages.length === 0) {
    error("No versionable packages found");
    error('- Ensure the packages to version are not in the "ignore" config');
    error('- Ensure that relevant package.json files have the "version" field');
    throw new ExitError(1);
  }

  const changesetBase = path.resolve(cwd, ".changeset");

  let newChangeset: Awaited<ReturnType<typeof createChangeset>>;
  if (empty) {
    newChangeset = {
      confirmed: true,
      releases: [],
      summary: ``,
    };
  } else if (auto) {
    // Auto mode: analyze only packages with committed changes
    const releases: AutoModeRelease[] = [];
    const skippedPackages: string[] = [];

    info(
      `Auto mode: Analyzing all versionable packages for committed changes...`
    );

    for (const pkg of versionablePackages as any[]) {
      const pkgName = pkg.packageJson.name;
      info(`Auto mode: Analyzing package ${pkgName}...`);
      const result = await getRecommendedBump(
        pkgName,
        pkg.dir,
        config,
        config.auto?.analyzer
      );

      if (result.bump) {
        releases.push({ name: pkgName, type: result.bump });
      } else {
        // Package has no commits or no conventional commits - skip it
        skippedPackages.push(pkgName);
      }
    }

    if (skippedPackages.length > 0) {
      warn(
        `Auto mode: Skipped ${
          skippedPackages.length
        } packages: ${skippedPackages.join(", ")}`
      );
    }

    if (releases.length === 0) {
      warn(
        "Auto mode: No packages with valid bumps found. This might indicate:"
      );
      warn("- No commits in the current branch affect packages");
      warn("- No conventional commits in the analyzed packages");
      warn("- All commits are filtered out or ignored");
      warn("Exiting without creating changeset...");
      return;
    } else {
      info(
        `Auto mode: Successfully analyzed ${releases.length} packages with bumps`
      );
    }

    newChangeset = {
      confirmed: true,
      releases,
      summary:
        "Auto-generated changeset based on conventional commit analysis.",
    };
  } else {
    let changedPackagesNames: string[] = [];
    try {
      changedPackagesNames = (
        await getVersionableChangedPackages(config, {
          cwd,
        })
      ).map((pkg: any) => pkg.packageJson.name);
    } catch (e: any) {
      // NOTE: Getting the changed packages is best effort as it's only being used for easier selection
      // in the CLI. So if any error happens while we try to do so, we only log a warning and continue
      warn(
        `Failed to find changed packages from the "${config.baseBranch}" base branch due to error below`
      );
      warn(e);
    }

    newChangeset = await createChangeset(
      changedPackagesNames,
      versionablePackages
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
    const [{ getAddMessage }, commitOpts] = getCommitFunctions(
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

export { add as addChangeset };
