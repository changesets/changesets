import chalk from "chalk";
import boxen from "boxen";
import outdent from "outdent";
import { Release, VersionType } from "@changesets/types";
import logger from "../../utils/logger";

export default function printConfirmationMessage(changeset: {
  releases: Array<Release>;
  summary: string;
}) {
  function getReleasesOfType(type: VersionType) {
    return changeset.releases
      .filter(release => release.type === type)
      .map(release => release.name);
  }
  logger.log("=== Releasing the following packages ===");
  const majorReleases = getReleasesOfType("major");
  const minorReleases = getReleasesOfType("minor");
  const patchReleases = getReleasesOfType("patch");

  if (majorReleases.length > 0)
    logger.log(`${chalk.green("[Major]")}\n  ${majorReleases.join(", ")}`);
  if (minorReleases.length > 0)
    logger.log(`${chalk.green("[Minor]")}\n  ${minorReleases.join(", ")}`);
  if (patchReleases.length > 0)
    logger.log(`${chalk.green("[Patch]")}\n  ${patchReleases.join(", ")}`);

  const message = outdent`
      ${chalk.red("========= NOTE ========")}
      All dependents of these packages that will be incompatible with the new version will be ${chalk.red(
        "patch bumped"
      )} when this changeset is applied.`;
  const prettyMessage = boxen(message, {
    borderStyle: "double",
    align: "center"
  });
  logger.log(prettyMessage);
}
