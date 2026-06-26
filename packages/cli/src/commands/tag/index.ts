import c from "@changesets/color";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import { log, progress } from "@clack/prompts";
import { getPackages, type Tool } from "@manypkg/get-packages";
import { getUntaggedPackages } from "../../utils/getUntaggedPackages.ts";
import { createOutputReport } from "../../utils/output.ts";
import { readConfig } from "../../utils/read-config.ts";
import { ensureChangesetFolder } from "../shared.ts";

function buildTag(tool: Tool, pkg: { name: string; newVersion: string }) {
  return tool.type !== "root"
    ? `${pkg.name}@${pkg.newVersion}`
    : `v${pkg.newVersion}`;
}

function buildTagMessage(
  tool: Tool,
  pkg: { name: string; newVersion: string },
) {
  return tool.type !== "root"
    ? `${c.blue(pkg.name)}@${c.green(pkg.newVersion)}`
    : c.cyan(`v${pkg.newVersion}`);
}

export interface TagOptions {
  cwd?: string;
  outputPath?: string;
}

export async function tag(options?: TagOptions) {
  const cwd = options?.cwd ?? process.cwd();
  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);

  const allExistingTags = await git.getAllTags(packages.rootDir);

  const taggablePackages = packages.packages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.tag,
      }),
  );

  const untaggedPackages = await getUntaggedPackages(
    taggablePackages,
    packages.rootDir,
    packages.tool,
  );
  const skippedTags = untaggedPackages.filter((pkg) =>
    allExistingTags.has(buildTag(packages.tool, pkg)),
  );
  if (untaggedPackages.length === 0) {
    log.info("Did not find any packages that need to be tagged.");
    return;
  }

  const p = progress({ max: untaggedPackages.length - skippedTags.length });
  p.start("Creating tags...");

  await using reporter = await createOutputReport(options?.outputPath);

  for (const pkg of untaggedPackages) {
    const tag = buildTag(packages.tool, pkg);
    if (allExistingTags.has(tag)) continue;

    await git.tag(tag, packages.rootDir);
    reporter?.write({
      type: "git-tag",
      tag,
      packageName: pkg.name,
    });

    p.advance(1, buildTagMessage(packages.tool, pkg));
  }

  const lines = [
    "Created tags:",
    untaggedPackages
      .map((pkg) => `   - ${buildTagMessage(packages.tool, pkg)}`)
      .join(`\n`),
  ];
  if (skippedTags.length !== 0) {
    lines.push(
      "Skipped tags (already exist):",
      ...skippedTags.map((pkg) => buildTagMessage(packages.tool, pkg)),
    );
  }

  p.stop(lines.join("\n"));
}
