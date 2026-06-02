import { readPreState } from "@changesets/pre";
import type { Config } from "@changesets/types";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import {
  type PublishReleaseEntry,
  type TagReleaseEntry,
  getUnpublishedPackages,
  getUntaggedPrivatePackages,
} from "../publish/getReleaseEntries.ts";
import { ensureChangesetFolder } from "../shared.ts";
import { readConfig } from "../../utils/read-config.ts";

export type PublishPlan = ReadonlyArray<
  ReadonlyArray<PublishReleaseEntry | TagReleaseEntry>
>;

export interface PublishPlanOptions {
  cwd?: string;
}

export async function publishPlan(
  options?: PublishPlanOptions,
): Promise<PublishPlan> {
  const cwd = options?.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);
  const preState = await readPreState(packages.rootDir);

  const releases = await getUnpublishedPackages(
    packages.packages,
    preState,
    config.access,
    {
      ignore: config.ignore,
      allowPrivatePackages: config.privatePackages.tag,
    },
  );

  const tagReleases = config.privatePackages?.tag
    ? await getUntaggedPrivatePackages(
        packages.rootDir,
        packages.packages,
        packages.tool,
        {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.tag,
        },
      )
    : [];

  if (releases.length === 0 && tagReleases.length === 0) {
    log.info("No projects to publish or tag.");
    return [];
  }

  if (releases.length > 0) {
    log.info(
      `
Packages to publish:
${releases.map((release) => `- ${release.name}@${release.version} (${release.tag})`).join("\n")}
      `.trim(),
    );
  }

  if (tagReleases.length > 0) {
    log.info(
      `
Packages to tag:
${tagReleases.map((release) => `- ${release.name}@${release.version}`).join("\n")}
      `.trim(),
    );
  }

  return [[...releases, ...tagReleases]];
}
