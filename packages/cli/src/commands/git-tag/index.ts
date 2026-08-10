import { shouldSkipPackage } from "@changesets/should-skip-package";
import { spinner } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { createOutputReport } from "../../utils/output.ts";
import { readConfig } from "../../utils/read-config.ts";
import { ensureChangesetFolder } from "../shared.ts";
import { createGitTags, formatGitTagResults } from "./utils.ts";

export interface GitTagOptions {
  cwd?: string;
  output?: string;
}

export async function gitTag(options?: GitTagOptions) {
  await using reporter = await createOutputReport(options?.output);
  const cwd = options?.cwd ?? process.cwd();
  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);

  const s = spinner();
  s.start("Creating git tags...");

  const releases = packages.packages
    .filter(
      (pkg) =>
        !shouldSkipPackage(pkg, {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.tag,
        }),
    )
    .map((pkg) => ({
      kind: "tag-only" as const,
      name: pkg.packageJson.name,
      version: pkg.packageJson.version,
    }));

  const results = await createGitTags({
    packages,
    releases,
    reporter,
  });
  if (results.tagged.length === 0) {
    s.stop("Did not find any packages that need to be tagged.");
    return;
  }

  s.stop(formatGitTagResults(packages.tool, results));
}
