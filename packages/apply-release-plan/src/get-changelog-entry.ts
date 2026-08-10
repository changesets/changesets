import type {
  ChangelogFunctions,
  ModCompWithPackage,
  NewChangesetWithCommit,
} from "@changesets/types";
import validRange from "semver/ranges/valid.js";
import { capitalize, shouldUpdateDependencyBasedOnConfig } from "./utils.ts";

type ChangelogLines = {
  major: Array<Promise<string>>;
  minor: Array<Promise<string>>;
  patch: Array<Promise<string>>;
};

// release is the package and version we are releasing
export async function getChangelogEntry(
  cwd: string,
  release: ModCompWithPackage,
  releases: ModCompWithPackage[],
  changesets: NewChangesetWithCommit[],
  changelogFuncs: ChangelogFunctions,
  changelogOpts: null | Record<string, unknown>,
  {
    updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange,
  }: {
    updateInternalDependencies: "patch" | "minor";
    onlyUpdatePeerDependentsWhenOutOfRange: boolean;
  },
) {
  if (release.type === "none") return null;

  const changelogLines: ChangelogLines = {
    major: [],
    minor: [],
    patch: [],
  };

  // I sort of feel we can do better, as ComprehensiveReleases have an array
  // of the relevant changesets but since we need the version type for the
  // release in the changeset, I don't know if we can
  // We can filter here, but that just adds another iteration over this list
  changesets.forEach((cs) => {
    const rls = cs.releases.find((r) => r.name === release.name);
    if (rls && rls.type !== "none") {
      changelogLines[rls.type].push(
        Promise.resolve(
          changelogFuncs.getReleaseLine(cs, rls.type, changelogOpts),
        ),
      );
    }
  });
  const dependentReleases = releases.filter((rel) => {
    const dependencyVersionRange = release.packageJson.dependencies?.[rel.name];
    const peerDependencyVersionRange =
      release.packageJson.peerDependencies?.[rel.name];

    const versionRange = dependencyVersionRange || peerDependencyVersionRange;
    const usesWorkspaceRange = versionRange?.startsWith("workspace:");
    return (
      versionRange &&
      (usesWorkspaceRange || validRange(versionRange) != null) &&
      shouldUpdateDependencyBasedOnConfig(
        cwd,
        rel,
        {
          depVersionRange: versionRange,
          depType: dependencyVersionRange ? "dependencies" : "peerDependencies",
        },
        {
          minReleaseType: updateInternalDependencies,
          onlyUpdatePeerDependentsWhenOutOfRange,
        },
      )
    );
  });

  const relevantChangesetIds: Set<string> = new Set();

  dependentReleases.forEach((rel) => {
    rel.changesets.forEach((cs) => {
      relevantChangesetIds.add(cs);
    });
  });

  const relevantChangesets = changesets.filter((cs) =>
    relevantChangesetIds.has(cs.id),
  );

  changelogLines.patch.push(
    Promise.resolve(
      changelogFuncs.getDependencyReleaseLine(
        relevantChangesets,
        dependentReleases,
        changelogOpts,
      ),
    ),
  );

  const resolvedChangelogLines = {
    major: await Promise.all(changelogLines.major),
    minor: await Promise.all(changelogLines.minor),
    patch: await Promise.all(changelogLines.patch),
  };

  return [
    `## ${release.newVersion}`,
    generateMarkdownForVersionType("major", resolvedChangelogLines.major),
    generateMarkdownForVersionType("minor", resolvedChangelogLines.minor),
    generateMarkdownForVersionType("patch", resolvedChangelogLines.patch),
  ]
    .filter((line) => line)
    .join("\n\n");
}

// Exported for test only
export function generateMarkdownForVersionType(
  type: keyof ChangelogLines,
  lines: Array<string>,
) {
  const releaseLines = lines.filter((l) => l);
  if (!releaseLines.length) return;

  let content = `### ${capitalize(type)} Changes`;
  // Track the new lines to be added between release lines. Start with two as we
  // want the extra spacing after the heading.
  let newLines = 2;

  for (const line of releaseLines) {
    // Factor in the starting new lines preferred by the release line
    const startNewLinesCount = line.match(/^\n*/)?.[0].length ?? 0;
    newLines += startNewLinesCount;

    // Ensure a minimum of one new line and maximum of two new lines between release lines
    const newLinesContent = "\n".repeat(Math.min(Math.max(newLines, 1), 2));
    content += newLinesContent + line.trim();

    // Count the ending new lines preferred by the release line for the next run
    const endNewLinesCount = line.match(/\n*$/)?.[0].length ?? 0;
    newLines = endNewLinesCount;
  }

  return content;
}
