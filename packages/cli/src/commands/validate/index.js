import getWorkspaces from "get-workspaces";
import semver from "semver";
import chalk from "chalk";

import { getDependencyVersionRange } from "../../utils/bolt-replacements/getDependencyInfo";
import logger from "../../utils/logger";
import versionRangeToRangeType from "../../utils/bolt-replacements/versionRangeToRangeType";

export default async function bumpReleasedPackages(config) {
  let allPackages = await getWorkspaces(config);

  let errors = [];

  for (let pkg of allPackages) {
    for (let pkg2 of allPackages) {
      let depRange = getDependencyVersionRange(pkg2.name, pkg.config);
      if (!depRange) continue;

      let cannotSymlink = !semver.satisfies(pkg2.config.version, depRange);
      if (cannotSymlink) {
        errors.push(
          chalk`- Update {green ${pkg.name}} to depend on {yellow "${
            pkg2.name
          }": "${versionRangeToRangeType(depRange)}${pkg2.config.version}"}`
        );
      }
    }
  }
  if (errors.length) {
    logger.error(
      "Oh no! Not everything can ge linked! Here's what you should do:"
    );
    errors.forEach(a => logger.error(a));
  } else {
    logger.success("Everything should link together nicely!");
  }
}
