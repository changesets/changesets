import c from "@changesets/color";
import * as git from "@changesets/git";
import type { Packages } from "@changesets/types";
import type { OutputReporter } from "../../utils/output.ts";
import type { TagReleaseEntry } from "../publish-plan/getPublishPlan.ts";

export function buildGitTag(
  tool: Packages["tool"],
  { name, version }: { name: string; version: string },
) {
  return tool.type !== "root" ? `${name}@${version}` : `v${version}`;
}

async function splitByTagStatus(
  packages: Packages,
  releases: TagReleaseEntry[],
  localTags: Set<string>,
): Promise<{ untagged: TagReleaseEntry[]; existing: TagReleaseEntry[] }> {
  const untagged: TagReleaseEntry[] = [];
  const existing: TagReleaseEntry[] = [];

  await Promise.all(
    releases.map(async (entry) => {
      const tagName = buildGitTag(packages.tool, entry);
      const hasTag =
        localTags.has(tagName) || (await git.remoteTagExists(tagName));

      if (!hasTag) {
        untagged.push(entry);
      } else {
        existing.push(entry);
      }
    }),
  );

  return { untagged, existing };
}

type CreateGitTagsOptions = {
  packages: Packages;
  releases: TagReleaseEntry[];
  reporter?: OutputReporter;
};

type CreateGitTagsResult = {
  tagged: TagReleaseEntry[];
  existing: TagReleaseEntry[];
};

// TODO: deduplicate with packages/cli/src/utils/getUntaggedPackages.ts
export async function createGitTags(
  opts: CreateGitTagsOptions,
): Promise<CreateGitTagsResult> {
  const existingTags = await git.getAllTags(opts.packages.rootDir);
  const { untagged, existing } = await splitByTagStatus(
    opts.packages,
    opts.releases,
    existingTags,
  );

  const newTags: TagReleaseEntry[] = [];
  for (const entry of untagged) {
    const tagName = buildGitTag(opts.packages.tool, entry);
    await git.tag(tagName, opts.packages.rootDir);
    opts.reporter?.write({
      type: "git-tag",
      tag: tagName,
      packageName: entry.name,
    });
    newTags.push(entry);
  }

  return { tagged: newTags, existing };
}

function buildTagMessage(tool: Packages["tool"], pkg: TagReleaseEntry) {
  return tool.type !== "root"
    ? `${c.blue(pkg.name)}@${c.green(pkg.version)}`
    : c.cyan(`v${pkg.version}`);
}

export function formatGitTagResults(
  tool: Packages["tool"],
  results: CreateGitTagsResult,
): string {
  const lines = [
    "Created git tags:",
    results.tagged
      .map((entry) => `- ${buildTagMessage(tool, entry)}`)
      .join(`\n`),
  ];
  if (results.existing.length !== 0) {
    lines.push(
      "Skipped tags (already exist):",
      ...results.existing.map((entry) => `- ${buildTagMessage(tool, entry)}`),
    );
  }

  return lines.join("\n");
}
