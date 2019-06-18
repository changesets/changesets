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

  if (majorReleases.length > 0)
    logger.log(`${green("[Major]")}\n  ${majorReleases.join(", ")}`);
  if (minorReleases.length > 0)
    logger.log(`${green("[Minor]")}\n  ${minorReleases.join(", ")}`);
  if (patchReleases.length > 0)
    logger.log(`${green("[Patch]")}\n  ${patchReleases.join(", ")}`);

  const message = outdent`
      ${red("========= NOTE ========")}
      When we need to bump dependents, we will do this as a ${red(
        "patch bump"
      )}.
      If any of the above need a higher bump than this, you will need to create a ${red(
        "separate changeset"
      )}
      
      If you want to see what we will currently patch bump, run \`yarn changeset status\``;
  const prettyMessage = boxen(message, {
    borderStyle: "double",
    align: "center"
  });
  logger.log(prettyMessage);
}
