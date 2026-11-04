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
import { importantWarning } from "../../utils/cli-utilities.ts";
import { readConfig } from "../../utils/read-config.ts";
import { getVersionableChangedPackages } from "../../utils/versionablePackages.ts";
import { ensureChangesetFolder } from "../shared.ts";
import {
  type BumpFlags,
  createChangeset,
  usesDetectedPackages,
} from "./createChangeset.ts";
import { printConfirmationMessage } from "./messages.ts";

export interface AddOptions extends BumpFlags {
  cwd?: string;
  empty?: boolean;
  open?: boolean;
  since?: string;
  message?: string;
}

export async function add(options?: AddOptions): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();

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
      releases: [],
      summary: options?.message ?? "",
    };
  } else {
    let changedPackagesNames: string[] = [];
    try {
      changedPackagesNames = (
        await getVersionableChangedPackages(config, {
          cwd: packages.rootDir,
          ref: options?.since,
        })
      ).map((pkg) => pkg.packageJson.name);
    } catch (error) {
      const message = `
Failed to identify which packages have changed since the ${options?.since ? "ref" : "base branch"} due to an error:
${(error as Error).toString()}
`.trim();

      // A release type option passed without a value has nothing to fall back
      // to, so the detection is no longer best effort.
      if (usesDetectedPackages(options ?? {})) {
        log.error(message);
        throw new ExitError(1);
      }

      // NOTE: Getting the changed packages is best effort as it's only being used for easier selection
      // in the CLI. So if any error happens while we try to do so, we only log a warning and continue
      log.warn(message);
    }

    newChangeset = await createChangeset(
      changedPackagesNames,
      versionablePackages,
      {
        message: options?.message,
        major: options?.major,
        minor: options?.minor,
        patch: options?.patch,
      },
    );
    printConfirmationMessage(newChangeset, versionablePackages.length > 1);
  }

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
