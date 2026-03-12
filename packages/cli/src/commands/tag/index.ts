import pc from "picocolors";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type { Config } from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { getUntaggedPackages } from "../../utils/getUntaggedPackages.ts";

export default async function tag(cwd: string, config: Config) {
  const { packages, tool } = await getPackages(cwd);

  const allExistingTags = await git.getAllTags(cwd);

  const taggablePackages = packages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.tag,
      }),
  );

  for (const { name, newVersion } of await getUntaggedPackages(
    taggablePackages,
    cwd,
    tool,
  )) {
    const tag =
      tool.type !== "root" ? `${name}@${newVersion}` : `v${newVersion}`;

    if (allExistingTags.has(tag)) {
      log.info("Skipping tag (already exists): ${pc.cyan(tag)}");
    } else {
      log.success(`New tag: ${pc.cyan(tag)}`);
      await git.tag(tag, cwd);
    }
  }
}
