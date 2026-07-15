import c from "@changesets/color";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type { Config, Package, Packages } from "@changesets/types";
import type { TagReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";
import type { OutputReporter } from "../utils/output.ts";

export function buildGitTag(
  tool: Packages["tool"],
  pkg:
    | Package
    | { name: string; newVersion: string }
    | { name: string; version: string },
) {
  const name = "packageJson" in pkg ? pkg.packageJson.name : pkg.name;
  const version =
    "packageJson" in pkg
      ? pkg.packageJson.version
      : ((pkg as { newVersion: string }).newVersion ??
        (pkg as { version: string }).version);

  return tool.type !== "root" ? `${name}@${version}` : `v${version}`;
}

async function splitByTagStatus(
  config: Config,
  packages: Packages,
  plan: TagReleaseEntry[],
  localTags: Set<string>,
): Promise<{ untagged: TagReleaseEntry[]; existing: TagReleaseEntry[] }> {
  const untagged: TagReleaseEntry[] = [];
  const existing: TagReleaseEntry[] = [];

  await Promise.all(
    plan.map(async (entry) => {
      const pkg = packages.packages.find(
        (pkg) => pkg.packageJson.name === entry.name,
      );
      const shouldSkip = shouldSkipPackage(pkg!, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.tag,
      });
      if (shouldSkip) return;

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
  config: Config;
  packages: Packages;
  plan?: TagReleaseEntry[];
  reporter?: OutputReporter;
};

type CreateGitTagsResult = {
  tagged: TagReleaseEntry[];
  existing: TagReleaseEntry[];
};

export async function createGitTags(
  opts: CreateGitTagsOptions,
): Promise<CreateGitTagsResult> {
  const plan =
    opts.plan ??
    opts.packages.packages.map((pkg) => ({
      kind: "tag-only",
      name: pkg.packageJson.name,
      version: pkg.packageJson.version,
    }));

  const existingTags = await git.getAllTags(opts.packages.rootDir);
  const { untagged, existing } = await splitByTagStatus(
    opts.config,
    opts.packages,
    plan,
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
