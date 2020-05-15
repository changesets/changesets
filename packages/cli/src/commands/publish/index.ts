import publishPackages from "./publishPackages";
import { ExitError } from "@changesets/errors";
import { error, log, success, warn } from "@changesets/logger";
import * as git from "@changesets/git";
import { readPreState } from "@changesets/pre";
import { Config } from "@changesets/types";
import chalk from "chalk";

function logReleases(pkgs: Array<{ name: string; newVersion: string }>) {
  const mappedPkgs = pkgs.map(p => `${p.name}@${p.newVersion}`).join("\n");
  log(mappedPkgs);
}

let importantSeparator = chalk.red(
  "===============================IMPORTANT!==============================="
);

let importantEnd = chalk.red(
  "----------------------------------------------------------------------"
);

export default async function run(
  cwd: string,
  { otp }: { otp?: string },
  config: Config
) {
  let preState = await readPreState(cwd);
  if (preState) {
    warn(importantSeparator);
    warn(
      `You are in prerelease mode so packages will be published to the ${chalk.cyan(
        preState.tag
      )} dist tag except for packages that have not had normal releases which will be published to ${chalk.cyan(
        "latest"
      )}`
    );
    warn(importantEnd);
  }

  const response = await publishPackages({
    cwd,
    // if not public, we wont pass the access, and it works as normal
    access: config.access,
    otp,
    preState
  });

  const successful = response.filter(p => p.published);
  const unsuccessful = response.filter(p => !p.published);

  if (successful.length > 0) {
    success("packages published successfully:");
    logReleases(successful);
    // We create the tags after the push above so that we know that HEAD wont change and that pushing
    // wont suffer from a race condition if another merge happens in the mean time (pushing tags wont
    // fail if we are behind master).
    log("Creating git tags...");
    for (const pkg of successful) {
      const tag = `${pkg.name}@${pkg.newVersion}`;
      log("New tag: ", tag);
      await git.tag(tag, cwd);
    }
  }

  if (unsuccessful.length > 0) {
    error("packages failed to publish:");

    logReleases(unsuccessful);
    throw new ExitError(1);
  }
}
