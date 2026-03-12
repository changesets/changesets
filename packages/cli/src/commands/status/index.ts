import pc from "picocolors";
import fs from "node:fs/promises";
import path from "path";
import { ExitError } from "@changesets/errors";
import getReleasePlan from "@changesets/get-release-plan";
import type { ComprehensiveRelease, Config } from "@changesets/types";
import { log } from "@clack/prompts";
import { getVersionableChangedPackages } from "../../utils/versionablePackages.ts";

export default async function status(
  cwd: string,
  {
    since,
    verbose,
    output,
  }: {
    since?: string;
    verbose?: boolean;
    output?: string;
  },
  config: Config,
) {
  const releasePlan = await getReleasePlan(cwd, since, config);
  const changedPackages = await getVersionableChangedPackages(config, {
    cwd,
    ref: since,
  });

  if (changedPackages.length > 0 && releasePlan.changesets.length === 0) {
    log.error(
      `
Some packages have been changed but no changesets were found. Run ${pc.cyan("changeset add")} to resolve this error.
If this change doesn't need a release, run ${pc.cyan("changeset add --empty")}.
      `.trim(),
    );
    throw new ExitError(1);
  }

  if (output) {
    await fs.writeFile(
      path.resolve(cwd, output),
      JSON.stringify(releasePlan, undefined, 2),
    );
    return;
  }

  printStatus(
    releasePlan.releases.toSorted((a, b) => a.name.localeCompare(b.name)),
    verbose,
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
  major: pc.red,
  minor: pc.blue,
  patch: pc.green,
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
        const addedLineIndex = lines.push(`  - ${pc.cyan(name)}`) - 1;

        if (verbose) {
          lines[addedLineIndex] += ` -> ${pc.green(newVersion)}`;
          lines.push(
            ...changesets.map((c) => `    - ${pc.blue(`.changeset/${c}.md`)}`),
          );
        }
      });

      return lines.flat().join("\n").trim();
    })
    .join("\n")
    .trim();
}
