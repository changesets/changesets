import fs from "node:fs/promises";
import path from "node:path";
import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import { readPreState } from "@changesets/pre";
import { readChangesets } from "@changesets/read";
import type { ComprehensiveRelease, ReleasePlan } from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { readConfig } from "../../utils/read-config.ts";
import { getVersionableChangedPackages } from "../../utils/versionablePackages.ts";
import { ensureChangesetFolder } from "../shared.ts";

export interface StatusOptions {
  cwd?: string;
  since?: string;
  verbose?: boolean;
  output?: string;
  allowNoChanges?: boolean;
}

export async function status(
  options?: StatusOptions,
): Promise<ReleasePlan | undefined> {
  const cwd = options?.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);

  const config = await readConfig(packages);
  const [changesets, preState] = await Promise.all([
    readChangesets(packages.rootDir, options?.since),
    readPreState(packages.rootDir),
  ]);

  const releasePlan = assembleReleasePlan(
    changesets,
    packages,
    config,
    preState,
  );
  const changedPackages = await getVersionableChangedPackages(config, {
    cwd: packages.rootDir,
    ref: options?.since,
  });

  if (changedPackages.length > 0 && releasePlan.changesets.length === 0) {
    log.warn(
      `
Some packages have been changed but no changesets were found. Run ${c.cyan("changeset add")} to resolve this error.
If this change doesn't need a release, run ${c.cyan("changeset add --empty")}.
      `.trim(),
    );

    if (options?.allowNoChanges) return;

    throw new ExitError(1);
  }

  if (options?.output) {
    await fs.writeFile(
      path.resolve(cwd, options.output),
      JSON.stringify(releasePlan, undefined, 2),
    );
    return;
  }

  printStatus(
    releasePlan.releases.toSorted((a, b) => a.name.localeCompare(b.name)),
    options?.verbose,
  );

  return releasePlan;
}

function printStatus(releases: ComprehensiveRelease[], verbose?: boolean) {
  log.info(
    `
Packages to be bumped:
${printPackageList(releases, verbose)}
    `.trim(),
  );
}

const typeColors = {
  major: c.red,
  minor: c.green,
  patch: c.blue,
} as const;

function printPackageList(releases: ComprehensiveRelease[], verbose?: boolean) {
  const majors = releases.filter((r) => r.type === "major");
  const minors = releases.filter((r) => r.type === "minor");
  const patches = releases.filter((r) => r.type === "patch");

  return (
    [
      ["major", majors],
      ["minor", minors],
      ["patch", patches],
    ] as const
  )
    .map(([type, releases]) => {
      if (releases.length === 0) return "";

      const lines = [`- ${typeColors[type](type)}`];

      releases.forEach(({ name, newVersion, changesets }) => {
        const addedLineIndex = lines.push(`  - ${c.cyan(name)}`) - 1;

        if (verbose) {
          lines[addedLineIndex] += ` -> ${c.green(newVersion)}`;
          lines.push(
            ...changesets.map(
              (changeset) => `    - ${c.blue(`.changeset/${changeset}.md`)}`,
            ),
          );
        }
      });

      return lines.flat().join("\n").trim();
    })
    .join("\n")
    .trim();
}
