import * as git from "@changesets/git";
import { getPackages } from "@manypkg/get-packages";
import { log } from "@changesets/logger";
import { Config } from "@changesets/types";
import { isListablePackage } from "../add/isListablePackage";

export default async function run(cwd: string, config: Config) {
  const { packages, tool } = await getPackages(cwd);

  const listablePackages = packages.filter((pkg) =>
    isListablePackage(config, pkg.packageJson)
  );

  const allExistingTags = await git.getAllTags(cwd);

  for (const pkg of listablePackages) {
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
