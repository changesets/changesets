import pc from "picocolors";
import { log } from "@clack/prompts";
import type { Release, VersionType } from "@changesets/types";

export default function printConfirmationMessage(
  changeset: {
    releases: Array<Release>;
    summary: string;
  },
  repoHasMultiplePackages: boolean,
) {
  function getReleasesOfType(type: VersionType) {
    return changeset.releases
      .filter((release) => release.type === type)
      .map((release) => release.name);
  }

  const majorReleases = getReleasesOfType("major");
  const minorReleases = getReleasesOfType("minor");
  const patchReleases = getReleasesOfType("patch");

  let msg = pc.bold("Summary of changesets:");
  if (majorReleases.length > 0) {
    msg += `\n${pc.bold(pc.green("major"))}:  ${majorReleases.join(", ")}`;
  }
  if (minorReleases.length > 0) {
    msg += `\n${pc.bold(pc.green("minor"))}:  ${minorReleases.join(", ")}`;
  }
  if (patchReleases.length > 0) {
    msg += `\n${pc.bold(pc.green("patch"))}:  ${patchReleases.join(", ")}`;
  }
  log.info(msg);

  if (repoHasMultiplePackages) {
    const message =
      "Note: All dependents of these packages that will be incompatible with the new version will be " +
      pc.redBright("patch bumped") +
      " when this changeset is applied.";

    log.info(message);
  }
}
