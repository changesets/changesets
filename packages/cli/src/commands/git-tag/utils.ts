import c from "@changesets/color";
import * as git from "@changesets/git";
import type { Packages } from "@changesets/types";
import { buildGitTag, splitByTagStatus } from "../../utils/gitTags.ts";
import type { OutputReporter } from "../../utils/output.ts";
import type { TagReleaseEntry } from "../publish-plan/getPublishPlan.ts";

type CreateGitTagsOptions = {
  packages: Packages;
  gitTagFormat: string | undefined;
  releases: TagReleaseEntry[];
  reporter?: OutputReporter;
};

type CreateGitTagsResult = {
  tagged: TagReleaseEntry[];
  existing: TagReleaseEntry[];
};

export async function createGitTags(
  opts: CreateGitTagsOptions,
): Promise<CreateGitTagsResult> {
  const { untagged, existing } = await splitByTagStatus(
    opts.packages.rootDir,
    opts.packages.tool,
    opts.releases,
    opts.gitTagFormat,
  );

  const newTags: TagReleaseEntry[] = [];
  for (const entry of untagged) {
    const tagName = buildGitTag(opts.packages.tool, entry, opts.gitTagFormat);
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

function buildTagMessage(
  tool: Packages["tool"],
  pkg: TagReleaseEntry,
  gitTagFormat: string | undefined,
) {
  if (gitTagFormat != null) {
    return c.cyan(buildGitTag(tool, pkg, gitTagFormat));
  }
  return tool.type !== "root"
    ? `${c.blue(pkg.name)}@${c.green(pkg.version)}`
    : c.cyan(`v${pkg.version}`);
}

export function formatGitTagResults(
  tool: Packages["tool"],
  results: CreateGitTagsResult,
  gitTagFormat: string | undefined,
): string {
  if (results.tagged.length === 0 && results.existing.length === 0) {
    return "Created git tags.";
  }

  const lines = [];
  if (results.tagged.length !== 0) {
    lines.push(
      "Created git tags:",
      ...results.tagged.map(
        (entry) => `- ${buildTagMessage(tool, entry, gitTagFormat)}`,
      ),
    );
  }
  if (results.existing.length !== 0) {
    lines.push(
      "Skipped tags (already exist):",
      ...results.existing.map(
        (entry) => `- ${buildTagMessage(tool, entry, gitTagFormat)}`,
      ),
    );
  }

  return lines.join("\n");
}
