import publishPackages from "./publishPackages";
import logger from "../../utils/logger";
import * as git from "@changesets/git";
import { ExitError } from "../../utils/errors";
import { readPreState } from "@changesets/pre";
import { Config } from "@changesets/types";

function logReleases(pkgs: Array<{ name: string; newVersion: string }>) {
  const mappedPkgs = pkgs.map(p => `${p.name}@${p.newVersion}`).join("\n");
  logger.log(mappedPkgs);
}

export default async function run(
  cwd: string,
  { otp }: { otp?: string },
  config: Config
) {
  let preState = await readPreState(cwd);

  const response = await publishPackages({
    cwd: cwd,
    // if not public, we wont pass the access, and it works as normal
    access: config.access,
    otp: otp,
    preState: preState
  });

  const successful = response.filter(p => p.published);
  const unsuccessful = response.filter(p => !p.published);

  if (successful.length > 0) {
    logger.success("packages published successfully:");
    logReleases(successful);
    // We create the tags after the push above so that we know that HEAD wont change and that pushing
    // wont suffer from a race condition if another merge happens in the mean time (pushing tags wont
    // fail if we are behind master).
    logger.log("Creating tags...");
    for (const pkg of successful) {
      const tag = `${pkg.name}@${pkg.newVersion}`;
      logger.log("New tag: ", tag);
      await git.tag(tag, cwd);
    }
  }

  if (unsuccessful.length > 0) {
    logger.error("packages failed to publish:");

    logReleases(unsuccessful);
    throw new ExitError(1);
  }
}
