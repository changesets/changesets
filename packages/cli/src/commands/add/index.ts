import chalk from "chalk";
import path from "path";
import { spawn } from "child_process";

import * as cli from "../../utils/cli-utilities";
import * as git from "@changesets/git";
import { error, info, log, warn } from "@changesets/logger";
import { ExitError } from "@changesets/errors";
import { Config } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import writeChangeset from "@changesets/write";

import { getCommitFunctions } from "../../commit/getCommitFunctions";
import createChangeset from "./createChangeset";
import printConfirmationMessage from "./messages";
import { ExternalEditor } from "external-editor";
import { PackageJSON } from "@changesets/types";

function isListablePackage(config: Config, packageJson: PackageJSON) {
  return (
    !config.ignore.includes(packageJson.name) &&
    (packageJson.version || !packageJson.private)
  );
}

interface AddFlags {
  all?: boolean;
  allChanged?: boolean;
  allUnchanged?: boolean;
  empty?: boolean;
  message?: string;
  open?: boolean;
  recommend?: boolean;
  yes?: boolean;
}

export default async function add(
  cwd: string,
  {
    all,
    allChanged,
    allUnchanged,
    empty,
    message,
    open,
    recommend,
    yes
  }: AddFlags,
  config: Config
) {
  const packages = (await getPackages(cwd)).packages.filter(pkg =>
    isListablePackage(config, pkg.packageJson)
  );
  const changesetBase = path.resolve(cwd, ".changeset");
  if (recommend === true && !config.conventionalCommits) {
    error(
      "You must enable conventional commits in .changeset/config.json to use the --recommend flag"
    );
    error('(try adding `"conventionalCommits": true`)');
    throw new ExitError(1);
  }
  let newChangeset: Awaited<ReturnType<typeof createChangeset>>;
  if (empty) {
    newChangeset = {
      confirmed: true,
      releases: [],
      summary: ``
    };
  } else {
    const changedPackages = await git.getChangedPackagesSinceRef({
      cwd,
      ref: config.baseBranch
    });
    const changedPackagesName = changedPackages
      .filter(pkg => isListablePackage(config, pkg.packageJson))
      .map(pkg => pkg.packageJson.name);

    newChangeset = await createChangeset(changedPackagesName, packages, {
      all,
      allChanged,
      allUnchanged,
      conventionalCommits:
        config.conventionalCommits === true
          ? "conventional-changelog-angular"
          : config.conventionalCommits,
      message,
      recommend,
      yes
    });
    printConfirmationMessage(newChangeset, packages.length > 1);

    if (!newChangeset.confirmed && yes !== true) {
      newChangeset = {
        ...newChangeset,
        confirmed: await cli.askConfirm("Is this your desired changeset?")
      };
    } else if (!newChangeset.confirmed && yes === true) {
      newChangeset = {
        ...newChangeset,
        confirmed: true
      };
    }
  }

  if (newChangeset.confirmed) {
    const changesetID = await writeChangeset(newChangeset, cwd);
    const [{ getAddMessage }, commitOpts] = getCommitFunctions(
      config.commit,
      cwd
    );
    if (getAddMessage) {
      await git.add(path.resolve(changesetBase, `${changesetID}.md`), cwd);
      await git.commit(await getAddMessage(newChangeset, commitOpts), cwd);
      log(chalk.green(`${empty ? "Empty " : ""}Changeset added and committed`));
    } else {
      log(
        chalk.green(
          `${empty ? "Empty " : ""}Changeset added! - you can now commit it\n`
        )
      );
    }

    let hasMajorChange = [...newChangeset.releases].find(
      c => c.type === "major"
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
        chalk.green(
          "If you want to modify or expand on the changeset summary, you can find it here"
        )
      );
    }
    const changesetPath = path.resolve(changesetBase, `${changesetID}.md`);
    info(chalk.blue(changesetPath));

    if (open) {
      // this is really a hack to reuse the logic embedded in `external-editor` related to determining the editor
      const externalEditor = new ExternalEditor();
      externalEditor.cleanup();
      spawn(
        externalEditor.editor.bin,
        externalEditor.editor.args.concat([changesetPath]),
        {
          detached: true,
          stdio: "inherit"
        }
      );
    }
  }
}
