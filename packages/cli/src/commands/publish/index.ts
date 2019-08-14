import publishPackages from "./publishPackages";
import logger from "../../utils/logger";
import * as git from "@changesets/git";
import resolveUserConfig from "../../utils/resolveConfig";
import { defaultConfig } from "../../utils/constants";
import { ExitError } from "../../utils/errors";

function logReleases(pkgs: Array<{ name: string; newVersion: string }>) {
  const mappedPkgs = pkgs.map(p => `${p.name}@${p.newVersion}`).join("\n");
  logger.log(mappedPkgs);
}

export default async function run(opts: { cwd: string; otp?: string }) {
  const userConfig = await resolveUserConfig(opts.cwd);
  const userPublishOptions =
    userConfig && userConfig.publishOptions ? userConfig.publishOptions : {};

  const config = {
    ...defaultConfig.publishOptions,
    ...userPublishOptions,
    ...opts
  };

  const response = await publishPackages({
    cwd: config.cwd || process.cwd(),
    // if not public, we wont pass the access, and it works as normal
    access: config.public ? "public" : undefined,
    otp: opts.otp
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
      await git.tag(tag, config.cwd);
    }
  }

  if (unsuccessful.length > 0) {
    logger.error("packages failed to publish:");

    logReleases(unsuccessful);
    throw new ExitError(1);
  }
}
