import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import stripAnsi from "strip-ansi";
import getReleasePlan from "@changesets/get-release-plan";
import { error, info, log, warn } from "@changesets/logger";
import {
  ComprehensiveRelease,
  Config,
  Release,
  VersionType,
} from "@changesets/types";
import { getVersionableChangedPackages } from "../../utils/versionablePackages";

export default async function status(
  cwd: string,
  {
    sinceMaster,
    since,
    verbose,
    output,
  }: {
    sinceMaster?: boolean;
    since?: string;
    verbose?: boolean;
    output?: string;
  },
  config: Config
) {
  if (sinceMaster) {
    warn(
      "--sinceMaster is deprecated and will be removed in a future major version"
    );
    warn("Use --since=master instead");
  }
  const sinceBranch =
    since === undefined ? (sinceMaster ? "master" : undefined) : since;
  const releasePlan = await getReleasePlan(cwd, sinceBranch, config);
  const { changesets, releases } = releasePlan;
  const changedPackages = await getVersionableChangedPackages(config, {
    cwd,
    ref: sinceBranch,
  });

  if (changedPackages.length > 0 && changesets.length === 0) {
    error(
      "Some packages have been changed but no changesets were found. Run `changeset add` to resolve this error."
    );
    error(
      "If this change doesn't need a release, run `changeset add --empty`."
    );
    process.exit(1);
  }

  if (output) {
    await fs.writeFile(
      path.join(cwd, output),
      JSON.stringify(releasePlan, undefined, 2)
    );
    return;
  }

  const print = verbose ? verbosePrint : SimplePrint;
  print("patch", releases);
  log("---");
  print("minor", releases);
  log("---");
  print("major", releases);

  return releasePlan;
}

function SimplePrint(type: VersionType, releases: Array<Release>) {
  const packages = releases.filter((r) => r.type === type);
  if (packages.length) {
    info(chalk`Packages to be bumped at {green ${type}}:\n`);

    const pkgs = packages.map(({ name }) => `- ${name}`).join("\n");
    log(chalk.green(pkgs));
  } else {
    info(chalk`{red NO} packages to be bumped at {green ${type}}`);
  }
}

function verbosePrint(
  type: VersionType,
  releases: Array<ComprehensiveRelease>
) {
  const packages = releases.filter((r) => r.type === type);
  if (packages.length) {
    info(chalk`Packages to be bumped at {green ${type}}`);

    const data = packages.map(({ name, newVersion: version, changesets }) => [
      chalk.green(name),
      version,
      changesets.map((c) => chalk.blue(` .changeset/${c}.md`)).join(" +"),
    ]);

    const t1 = table(
      [
        { value: chalk.yellow("Package Name"), width: 20 },
        { value: chalk.yellow("New Version"), width: 20 },
        { value: chalk.yellow("Related Changeset Summaries"), width: 70 },
      ],
      data
    );
    log(t1);
  } else {
    info(
      chalk`Running release would release {red NO} packages as a {green ${type}}`
    );
  }
}

function table(headers: { value: string; width: number }[], data: string[][]) {
  let str = "\n";

  // Find the max width for the column to prevent line breaks
  const columnWidths = headers.map((header, i) => {
    return Math.max(
      header.width,
      ...data.map((row) => stripAnsi(row[i]).length)
    );
  });

  str += `  ┌${headers.map((h) => "─".repeat(h.width)).join("┬")}┐\n`;
  str += `  │${headers.map((h) => padAround(h.value, h.width)).join("│")}│\n`;
  str += `  ├${headers.map((h) => "─".repeat(h.width)).join("┼")}┤\n`;
  for (const row of data) {
    str += `  │${row
      .map((value, j) => ` ${padEnd(value, columnWidths[j] - 2)} `)
      .join("│")}│\n`;
  }
  str += `  └${headers.map((h) => "─".repeat(h.width)).join("┴")}┘\n`;

  return str;
}

/**
 * ANSI-safe version of padEnd
 */
function padEnd(str: string, width: number) {
  const ansiLength = str.length - stripAnsi(str).length;
  return str + " ".repeat(width - str.length + ansiLength);
}

/**
 * ANSI-safe version that pads around the string to center it
 */
function padAround(str: string, width: number) {
  const ansiLength = str.length - stripAnsi(str).length;
  const diff = width - str.length + ansiLength;
  const left = Math.floor(diff / 2);
  const right = Math.ceil(diff / 2);
  return " ".repeat(left) + str + " ".repeat(right);
}
