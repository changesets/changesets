import path from "node:path";
import { fileURLToPath } from "node:url";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import { writeChangeset } from "@changesets/write";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import launchEditor from "launch-editor";
import { getCommitFunctions } from "../../commit/getCommitFunctions.ts";
import * as cli from "../../utils/cli-utilities.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";
import { readConfig } from "../../utils/read-config.ts";
import { getVersionableChangedPackages } from "../../utils/versionablePackages.ts";
import { ensureChangesetFolder } from "../shared.ts";
import { askSummary, createChangeset, isBumpType } from "./createChangeset.ts";
import { printConfirmationMessage } from "./messages.ts";

export interface AddOptions {
  cwd?: string;
  empty?: boolean;
  open?: boolean;
  since?: string;
  message?: string;
  type?: string;
}

export async function add(options?: AddOptions): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();

  const typeFromCli = options?.type;
  if (typeFromCli != null && !isBumpType(typeFromCli)) {
    log.error(
      `Only ${c.cyan("patch")}, ${c.cyan("minor")} or ${c.cyan("major")} is accepted as the bump type`,
    );
    throw new ExitError(1);
  }
  if (typeFromCli != null && options?.empty) {
    log.error(
      `The ${c.cyan("--type")} option cannot be used with ${c.cyan("--empty")}`,
    );
    throw new ExitError(1);
  }

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  if (packages.packages.length === 0) {
    log.error(
      `No packages found. You might have ${packages.tool.type} workspaces configured but no packages yet?`,
    );
    throw new ExitError(1);
  }

  const config = await readConfig(packages);

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
  ${c.italic("Ensure the packages to version are not ignored by the config")}
  ${c.italic("Ensure that relevant package.json files have a `version` field")}
`.trim(),
    );
    throw new ExitError(1);
  }

  const changesetBase = path.resolve(packages.rootDir, ".changeset");

  let newChangeset: Awaited<ReturnType<typeof createChangeset>>;
  if (options?.empty) {
    newChangeset = {
      confirmed: true,
      releases: [],
      summary: options?.message ?? "",
    };
  } else {
    // With a single versionable package there is nothing to select from, so there is no need to
    // detect the changed packages
    let changedPackagesNames: string[] = [];
    if (versionablePackages.length > 1) {
      try {
        changedPackagesNames = (
          await getVersionableChangedPackages(config, {
            cwd: packages.rootDir,
            ref: options?.since,
          })
        ).map((pkg) => pkg.packageJson.name);
      } catch (error) {
        const errorMessage = `
Failed to identify which packages have changed since the ${options?.since ? "ref" : "base branch"} due to an error:
${(error as Error).toString()}
`.trim();

        // With `--type` the changed packages determine what gets released, so we can't continue without them
        if (typeFromCli != null) {
          log.error(errorMessage);
          throw new ExitError(1);
        }

        // NOTE: Getting the changed packages is best effort as it's only being used for easier selection
        // in the CLI. So if any error happens while we try to do so, we only log a warning and continue
        log.warn(errorMessage);
      }

      if (typeFromCli != null && changedPackagesNames.length === 0) {
        log.error(
          `No changed packages found since ${c.cyan(options?.since ?? config.baseBranch)} to apply the bump type to`,
        );
        throw new ExitError(1);
      }
    }

    if (typeFromCli != null) {
      const packagesToRelease =
        versionablePackages.length > 1
          ? changedPackagesNames.toSorted((a, b) => a.localeCompare(b))
          : [versionablePackages[0].packageJson.name];

      newChangeset = {
        ...(options?.message != null
          ? // when both the type and the message are provided there is nothing left to ask about
            { confirmed: true, summary: options.message }
          : await askSummary()),
        releases: packagesToRelease.map((name) => ({
          name,
          type: typeFromCli,
        })),
      };
    } else {
      newChangeset = await createChangeset(
        changedPackagesNames,
        versionablePackages,
        options?.message,
      );
    }
    printConfirmationMessage(newChangeset, versionablePackages.length > 1);

    if (!newChangeset.confirmed) {
      newChangeset = {
        ...newChangeset,
        confirmed: await cli.askConfirm("Is this your desired changeset?"),
      };
    }
  }

  if (newChangeset.confirmed) {
    const changesetID = await writeChangeset(
      newChangeset,
      packages.rootDir,
      config,
    );
    const [{ getAddMessage }, commitOpts] = await getCommitFunctions(
      config.commit,
      packages.rootDir,
      path.dirname(fileURLToPath(import.meta.url)),
    );

    const finalLogMessageLines: string[] = [];

    if (getAddMessage) {
      await git.add(
        path.resolve(changesetBase, `${changesetID}.md`),
        packages.rootDir,
      );
      await git.commit(
        await getAddMessage(newChangeset, commitOpts),
        packages.rootDir,
      );
      finalLogMessageLines.push(
        c.green(
          `${options?.empty ? "Empty " : ""}Changeset added and committed!`,
        ),
      );
    } else {
      finalLogMessageLines.push(
        c.green(
          `${options?.empty ? "Empty " : ""}Changeset added - you can now commit it!`,
        ),
      );
    }

    const hasMajorChange = [...newChangeset.releases].find(
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
        c.green(
          "If you want to modify or expand on the changeset summary, you can find it here:",
        ),
      );
    }

    const changesetPath = path.relative(
      process.cwd(),
      path.join(changesetBase, `${changesetID}.md`),
    );
    finalLogMessageLines.push(c.blue(changesetPath));

    log.success(finalLogMessageLines.join("\n"));

    if (options?.open) {
      launchEditor(changesetPath);
    }
  }
}
