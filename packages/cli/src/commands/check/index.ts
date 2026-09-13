import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import { readPreState } from "@changesets/pre";
import { readChangesets } from "@changesets/read";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { readConfig } from "../../utils/read-config.ts";
import { ensureChangesetFolder } from "../shared.ts";

export interface CheckOptions {
  cwd?: string;
}

export async function check(options?: CheckOptions): Promise<void> {
  const cwd = options?.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);
  const preState = await readPreState(packages.rootDir);

  let changesets;
  try {
    changesets = await readChangesets(packages.rootDir);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.error(
      `Failed to parse changesets:\n${error.message}\n\nFix or remove the invalid file before running ${c.cyan("changeset version")}.`,
    );
    throw new ExitError(1, { cause: error });
  }

  try {
    assembleReleasePlan(changesets, packages, config, preState);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.error(
      `Invalid changesets detected:\n${error.message}\n\nFix or remove the invalid file before running ${c.cyan("changeset version")}.`,
    );
    throw new ExitError(1, { cause: error });
  }

  log.info(`All ${changesets.length} changeset(s) are valid.`);
}
