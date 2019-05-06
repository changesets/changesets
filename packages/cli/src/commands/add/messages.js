/* eslint-disable import/prefer-default-export */
import { green, red } from "chalk";
import boxen from "boxen";
import outdent from "outdent";
import logger from "../../utils/logger";

export function printConfirmationMessage(changeset) {
  function getReleasesOfType(type) {
    return changeset.releases
      .filter(release => release.type === type)
      .map(release => release.name);
  }
  logger.log("=== Releasing the following packages ===");
  const majorReleases = getReleasesOfType("major");
  const minorReleases = getReleasesOfType("minor");
  const patchReleases = getReleasesOfType("patch");
  const patchDependents = changeset.dependents
    .filter(dep => dep.type === "patch")
    .map(dep => dep.name);
  const majorDependents = changeset.dependents
    .filter(dep => dep.type === "major")
    .map(dep => red(dep.name));

  if (majorReleases.length > 0)
    logger.log(`${green("[Major]")}\n  ${majorReleases.join(", ")}`);
  if (minorReleases.length > 0)
    logger.log(`${green("[Minor]")}\n  ${minorReleases.join(", ")}`);
  if (patchReleases.length > 0)
    logger.log(`${green("[Patch]")}\n  ${patchReleases.join(", ")}`);
  if (patchDependents.length > 0)
    logger.log(
      `${green("[Dependents (patch)]")}\n  ${patchDependents.join("\n  ")}`
    );
  if (majorDependents.length > 0)
    logger.log(
      `${green("[Dependents (major)]")}\n  ${majorDependents.join("\n  ")}`
    );

  if (changeset.dependents.length > 0) {
    const message = outdent`
      ${red("========= NOTE ========")}
      All dependents that are bumped will be ${red("patch bumped")}.
      If any of the above need a higher bump than this, you will need to create a ${red(
        "separate changeset"
      )} for this
      Please read the above list ${red(
        "carefully"
      )} to make sure you're not missing anything!`;
    const prettyMessage = boxen(message, {
      borderStyle: "double",
      align: "center"
    });
    logger.log(prettyMessage);
  }
}
