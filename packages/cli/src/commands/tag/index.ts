import * as git from "@changesets/git";
import { getPackages } from "@manypkg/get-packages";
import { log } from "@changesets/logger";
import { filterTaggablePackages } from "../../utils/versionablePackages";
import { Config } from "@changesets/types";

export default async function run(cwd: string, config: Config) {
  const { packages, tool } = await getPackages(cwd);

  const allExistingTags = await git.getAllTags(cwd);

  for (const pkg of filterTaggablePackages(config, packages)) {
    const tag =
      tool !== "root"
        ? `${pkg.packageJson.name}@${pkg.packageJson.version}`
        : `v${pkg.packageJson.version}`;

    if (allExistingTags.has(tag)) {
      log("Skipping tag (already exists): ", tag);
    } else {
      log("New tag: ", tag);
      await git.tag(tag, cwd);
    }
  }
}
