import type { Package } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";

export const BumpLevels = {
  dep: 0,
  patch: 1,
  minor: 2,
  major: 3,
} as const;

export async function getVersionsByDirectory(cwd: string) {
  const { packages } = await getPackages(cwd);
  return new Map(packages.map((x) => [x.dir, x.packageJson.version]));
}

export async function getChangedPackages(
  cwd: string,
  previousVersions: Map<string, string>,
) {
  const { packages } = await getPackages(cwd);
  const changedPackages = new Set<Package>();

  for (const pkg of packages) {
    const previousVersion = previousVersions.get(pkg.dir);
    if (previousVersion !== pkg.packageJson.version) {
      changedPackages.add(pkg);
    }
  }

  return [...changedPackages];
}

export function getChangelogEntry(changelog: string, version: string) {
  let highestLevel: number = BumpLevels.dep;
  let headingStartInfo: { index: number; depth: number } | undefined;
  let endIndex: number | undefined;

  // Iterate through each headings and code blocks (for skipping its contents)
  const regex = /^(#{1,6})\s(.*)$|^(`{3,})/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(changelog)) != null) {
    // Skip over code blocks so we don't match any headings inside of them
    if (match[3]) {
      const endOfCodeBlockRegex = new RegExp(`^${match[3]}`, "gm");
      endOfCodeBlockRegex.lastIndex = regex.lastIndex;
      const endMatch = endOfCodeBlockRegex.exec(changelog);
      if (endMatch) {
        // Start next search for headings after the end of the code block
        regex.lastIndex = endOfCodeBlockRegex.lastIndex;
        continue;
      } else {
        // Can't find end of code block, probably malformed
        break;
      }
    }

    const headingDepth = match[1].length;
    const headingText = match[2].trim();

    // Search for the highest bump level in the entire changelog
    const levelMatch = /(major|minor|patch)/.exec(headingText.toLowerCase());
    if (levelMatch != null) {
      const level = BumpLevels[levelMatch[0] as "major" | "minor" | "patch"];
      highestLevel = Math.max(level, highestLevel);
    }

    // Search for heading of the entry
    if (headingText === version) {
      headingStartInfo = { index: regex.lastIndex, depth: headingDepth };
      continue;
    }

    // If we've found the entry heading, search for the closing heading with the same depth
    if (headingStartInfo && headingDepth === headingStartInfo.depth) {
      endIndex = match.index;
      break;
    }
  }

  return {
    content: changelog.slice(headingStartInfo?.index, endIndex).trim(),
    highestLevel,
  };
}

export function sortChangelogEntries(
  a: { private: boolean; highestLevel: number },
  b: { private: boolean; highestLevel: number },
) {
  if (a.private === b.private) {
    return b.highestLevel - a.highestLevel;
  }
  if (a.private) {
    return 1;
  }
  return -1;
}
