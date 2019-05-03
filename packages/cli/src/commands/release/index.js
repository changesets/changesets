/* eslint-disable no-await-in-loop */
import * as bolt from "../../utils/bolt-replacements";
import logger from "../../utils/logger";
import * as git from "../../utils/git";
import resolveUserConfig from "../../utils/resolveConfig";
import { defaultConfig } from "../../utils/constants";

function logReleases(status, pkgs) {
  const mappedPkgs = pkgs.map(p => `${p.name}@${p.newVersion}`).join("\n");
  logger.success(`Packages ${status} published:`);
  logger.log(mappedPkgs);
}

export default async function run(opts) {
  const userConfig = await resolveUserConfig({ cwd: opts.cwd });
  const userPublishOptions =
    userConfig && userConfig.publishOptions ? userConfig.publishOptions : {};

  const config = {
    ...defaultConfig.publishOptions,
    ...userPublishOptions,
    ...opts
  };

  const publishOpts = {};
  publishOpts.cwd = config.cwd || process.cwd();
  // if not public, we wont pass the access, and it works as normal
  if (config.public) publishOpts.access = "public";
  // Note: we use publishPackages, not publish here as publishPackages returns a list of published
  // and unpublished packages, publish does not (as of bolt 0.21.0)
  const response = await bolt.publishPackages(publishOpts);

  const successful = response.filter(p => p.published);
  const unsuccessful = response.filter(p => !p.published);

  if (successful.length > 0) {
    logReleases("successfully", successful);
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
    logReleases("failed to", unsuccessful);
    throw new Error(`Some releases failed: ${JSON.stringify(response)}`);
  }
}
