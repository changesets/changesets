import pc from "picocolors";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type { Config } from "@changesets/types";
import { log, progress } from "@clack/prompts";
import { getPackages, type Tool } from "@manypkg/get-packages";
import { getUntaggedPackages } from "../../utils/getUntaggedPackages.ts";

function buildTag(tool: Tool, pkg: { name: string; newVersion: string }) {
  return tool.type !== "root" ? `${pkg.name}@${pkg.newVersion}` : `v${pkg.newVersion}`;
}

function buildTagMessage(
  tool: Tool,
  pkg: { name: string; newVersion: string },
) {
  return tool
    ? `${pc.blue(pkg.name)}@${pc.green(pkg.newVersion)}`
    : pc.cyan(`v${pkg.newVersion}`);
}

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

  const untaggedPackages = await getUntaggedPackages(
    taggablePackages,
    cwd,
    tool,
  );
  const skippedTags = untaggedPackages.filter((pkg) =>
    allExistingTags.has(buildTag(tool, pkg)),
  );
  if (untaggedPackages.length === 0) {
    log.info("Did not find any packages that need to be tagged.");
    return;
  }

  const p = progress({ max: untaggedPackages.length - skippedTags.length });
  p.start("Creating tags...");

  for (const pkg of untaggedPackages) {
    const tag = buildTag(tool, pkg);
    await git.tag(tag, cwd);

    p.advance(1, buildTagMessage(tool, pkg));
  }

  const lines = [
    "Created tags:",
    untaggedPackages.map((pkg) => `   - ${buildTagMessage(tool, pkg)}`).join(`\n`),
  ]
  if (skippedTags.length !== 0) {
    lines.push(
      "Skipped tags (already exist):",
      ...skippedTags.map((pkg) => buildTagMessage(tool, pkg)),
    );
  }

  p.stop(lines.join("\n"));
}
