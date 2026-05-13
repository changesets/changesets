import c from "@changesets/color";
import type { Release, VersionType } from "@changesets/types";
import { log } from "@clack/prompts";

export function printConfirmationMessage(
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

  let msg = c.bold("Summary of changesets:");
  if (majorReleases.length > 0) {
    msg += `\n${c.bold(c.red("major"))}:  ${majorReleases.join(", ")}`;
  }
  if (minorReleases.length > 0) {
    msg += `\n${c.bold(c.green("minor"))}:  ${minorReleases.join(", ")}`;
  }
  if (patchReleases.length > 0) {
    msg += `\n${c.bold(c.blue("patch"))}:  ${patchReleases.join(", ")}`;
  }
  log.success(msg);

  if (repoHasMultiplePackages) {
    log.info(
      `
Note: All packages that depend on these whose required versions
will be incompatible will also be ${c.blue("patch")} bumped
when this changeset is applied.
      `.trim(),
    );
  }
}
