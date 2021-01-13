import chalk from "chalk";
import table from "tty-table";
import fs from "fs-extra";
import path from "path";

import * as git from "@changesets/git";
import getReleasePlan from "@changesets/get-release-plan";
import { error, log, info, warn } from "@changesets/logger";
import {
  VersionType,
  Release,
  ComprehensiveRelease,
  Config
} from "@changesets/types";

export default async function getStatus(
  cwd: string,
  {
    sinceMaster,
    since,
    verbose,
    output
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
  const changedPackages = await git.getChangedPackagesSinceRef({
    cwd,
    ref: sinceBranch || config.baseBranch
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
  const packages = releases.filter(r => r.type === type);
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
  const packages = releases.filter(r => r.type === type);
  if (packages.length) {
    info(chalk`Packages to be bumped at {green ${type}}`);

    const columns = packages.map(
      ({ name, newVersion: version, changesets }) => [
        chalk.green(name),
        version,
        changesets
          .map(c => chalk.blue(` .changeset/${c}/changes.md`))
          .join(" +")
      ]
    );

    const t1 = table(
      [
        { value: "Package Name", width: 20 },
        { value: "New Version", width: 20 },
        { value: "Related Changeset Summaries", width: 70 }
      ],
      columns,
      { paddingLeft: 1, paddingRight: 0, headerAlign: "center", align: "left" }
    );
    log(t1.render() + "\n");
  } else {
    info(
      chalk`Running release would release {red NO} packages as a {green ${type}}`
    );
  }
}
