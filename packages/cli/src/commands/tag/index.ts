import * as git from "@changesets/git";
import { getPackages } from "@manypkg/get-packages";
import { log } from "@changesets/logger";
import { Config } from "@changesets/types";

export default async function run(cwd: string, config: Config) {
  const { packages, tool } = await getPackages(cwd);

  const allExistingTags = await git.getAllTags(cwd);

  for (const { packageJson } of packages) {
    if (
      config.ignore.includes(packageJson.name) ||
      (!packageJson.version && packageJson.private)
    ) {
      break;
    }

    const tag =
      tool !== "root"
        ? `${packageJson.name}@${packageJson.version}`
        : `v${packageJson.version}`;

    if (allExistingTags.has(tag)) {
      log("Skipping tag (already exists): ", tag);
    } else {
      log("New tag: ", tag);
      await git.tag(tag, cwd);
    }
  }
}
