import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyReleasePlan } from "@changesets/apply-release-plan";
import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import { ExitError } from "@changesets/errors";
import * as git from "@changesets/git";
import { readPreState } from "@changesets/pre";
import { readChangesets } from "@changesets/read";
import type { Config } from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import pc from "picocolors";
import { getCommitFunctions } from "../../commit/getCommitFunctions.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";

export async function version(
  cwd: string,
  options: { snapshot?: string | boolean },
  config: Config,
) {
  const releaseConfig = {
    ...config,
    // Disable committing when in snapshot mode
    commit: options.snapshot ? false : config.commit,
  };
  const [changesets, preState] = await Promise.all([
    readChangesets(cwd),
    readPreState(cwd),
  ]);

  if (preState?.mode === "pre") {
    if (options.snapshot != null) {
      log.error(
        `
Snapshot release is not allowed in pre mode.
To resolve this exit the pre mode by running ${pc.cyan("changeset pre exit")}.
        `.trim(),
      );
      throw new ExitError(1);
    } else {
      importantWarning(
        `
You are in prerelease mode!
If you meant to do a normal release you should revert these changes and run ${pc.cyan("changeset pre exit")}.
You can then run ${pc.cyan("changeset version")} again to do a normal release.
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

  const packages = await getPackages(cwd);

  const releasePlan = assembleReleasePlan(
    changesets,
    packages,
    releaseConfig,
    preState,
    options.snapshot
      ? {
          tag: options.snapshot === true ? undefined : options.snapshot,
          commit: config.snapshot.prereleaseTemplate?.includes("{commit}")
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
