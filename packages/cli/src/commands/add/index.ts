import pc from "picocolors";
import path from "node:path";
import launchEditor from "launch-editor";

import * as git from "@changesets/git";
import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type { Config } from "@changesets/types";
import writeChangeset from "@changesets/write";
import { getPackages } from "@manypkg/get-packages";
import { getCommitFunctions } from "../../commit/getCommitFunctions.ts";
import * as cli from "../../utils/cli-utilities.ts";
import { getVersionableChangedPackages } from "../../utils/versionablePackages.ts";
import createChangeset from "./createChangeset.ts";
import printConfirmationMessage from "./messages.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";

export default async function add(
  cwd: string,
  {
    empty,
    open,
    since,
    message,
  }: { empty?: boolean; open?: boolean; since?: string; message?: string },
  config: Config,
): Promise<void> {
  const packages = await getPackages(cwd);
  if (packages.packages.length === 0) {
    log.error(
      `No packages found. You might have ${packages.tool} workspaces configured but no packages yet?`,
    );
    throw new ExitError(1);
  }

  const versionablePackages = packages.packages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      }),
  );

  if (versionablePackages.length === 0) {
    log.error(
      `
No versionable packages found
  ${pc.italic("Ensure the packages to version are not ignored by the config")}
  ${pc.italic("Ensure that relevant package.json files have a `version` field")}
`.trim(),
    );
    throw new ExitError(1);
  }

  const changesetBase = path.resolve(cwd, ".changeset");

  let newChangeset: Awaited<ReturnType<typeof createChangeset>>;
  if (empty) {
    newChangeset = {
      confirmed: true,
      releases: [],
      summary: message ?? "",
    };
  } else {
    let changedPackagesNames: string[] = [];
    try {
      changedPackagesNames = (
        await getVersionableChangedPackages(config, {
          cwd,
          ref: since,
        })
      ).map((pkg) => pkg.packageJson.name);
    } catch (error) {
      // NOTE: Getting the changed packages is best effort as it's only being used for easier selection
      // in the CLI. So if any error happens while we try to do so, we only log a warning and continue
      log.warn(
        `
Failed to identify which packages have changed since the ${since ? "ref" : "base branch"} due to an error:
${(error as Error).toString()}
`.trim(),
      );
    }

    newChangeset = await createChangeset(
      changedPackagesNames,
      versionablePackages,
      message,
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
      cwd,
    );

    let finalLogMessageLines: string[] = [];

    if (getAddMessage) {
      await git.add(path.resolve(changesetBase, `${changesetID}.md`), cwd);
      await git.commit(await getAddMessage(newChangeset, commitOpts), cwd);
      finalLogMessageLines.push(
        pc.green(`${empty ? "Empty " : ""}Changeset added and committed!`),
      );
    } else {
      finalLogMessageLines.push(
        pc.green(
          `${empty ? "Empty " : ""}Changeset added - you can now commit it!`,
        ),
      );
    }

    let hasMajorChange = [...newChangeset.releases].find(
      (c) => c.type === "major",
    );

    if (hasMajorChange) {
      importantWarning(
        `
This Changeset includes a major change and we STRONGLY recommend adding more information to the changeset:
  WHAT the breaking change is
  WHY the change was made
  HOW a consumer should update their code
        `,
      );
    } else {
      finalLogMessageLines.push(
        pc.green(
          "If you want to modify or expand on the changeset summary, you can find it here:",
        ),
      );
    }

    const changesetPath = path.relative(
      process.cwd(),
      path.join(changesetBase, `${changesetID}.md`),
    );
    finalLogMessageLines.push(pc.blue(changesetPath));

    log.success(finalLogMessageLines.join("\n"));

    if (open) {
      launchEditor(changesetPath);
    }
  }
}
