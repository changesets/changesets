import * as git from "@changesets/git";
import { getPackages } from "@manypkg/get-packages";
import { log } from "@changesets/logger";
import { parsePackage, replacePlaceholders } from "./parsePackage";

export default async function run(cwd: string, format?: string) {
  const { packages, tool } = await getPackages(cwd);

  const allExistingTags = await git.getAllTags(cwd);

  for (const pkg of packages) {
    const parseResult = parsePackage(pkg.packageJson);
    const tag =
      tool !== "root"
        ? replacePlaceholders(parseResult, format)
        : replacePlaceholders(parseResult, format ?? "v{version}");

    if (allExistingTags.has(tag)) {
      log("Skipping tag (already exists): ", tag);
    } else {
      log("New tag: ", tag);
      await git.tag(tag, cwd);
    }
  }
}
