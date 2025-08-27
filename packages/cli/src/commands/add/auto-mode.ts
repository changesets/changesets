import { execSync } from "child_process";
import { info, warn } from "@changesets/logger";
import { Config, VersionType } from "@changesets/types";

// Types for auto mode functionality

export type CommitAnalysisResult = {
  bump: VersionType | null;
};

// Type for the analyzer function
export type CommitAnalyzer = (
  commits: Array<{ hash: string; message: string }>,
  preset: string
) => Promise<VersionType>;

// Git utility types
export type Commit = {
  hash: string;
  message: string;
};

// Custom error type for better error handling
export class CommitAnalysisError extends Error {
  constructor(
    message: string,
    public readonly pkgName: string,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = "CommitAnalysisError";
  }
}

// Default analyzer that dynamically imports the ES module
async function getDefaultAnalyzer(): Promise<CommitAnalyzer> {
  try {
    const { analyzeConventionalCommits } = await import("./semanticAnalyzer");
    return analyzeConventionalCommits;
  } catch (error) {
    throw new Error(
      `Failed to load default analyzer: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Git utility functions
export function getLastTag(pkgName: string): string | null {
  try {
    const allTags = execSync(`git tag --list --sort=-v:refname`, {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

    // Find the most recent tag for this package
    for (const tag of allTags) {
      if (tag.startsWith(`${pkgName}@`)) {
        return tag;
      }
    }
  } catch (error) {
    warn(
      `Failed to get git tags: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  return null;
}

export function getCommitsSinceTag(
  lastTag: string,
  pkgDir: string,
  maxCommits: number
): Commit[] {
  try {
    const commitsOutput = execSync(
      `git log --format="%H%n%B" ${lastTag}..HEAD -- ${pkgDir}`,
      { encoding: "utf8" }
    );

    // Parse commits - handle multi-line commit messages correctly
    const lines = commitsOutput
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "");
    const commits: Commit[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check if this line is a commit hash (40 character hex string)
      if (line.match(/^[a-fA-F0-9]{40}$/)) {
        const hash = line;
        const messageLines: string[] = [];
        // Collect all lines until we find the next hash or reach the end
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/^[a-fA-F0-9]{40}$/)) {
          messageLines.push(lines[j]);
          j++;
        }
        // Create commit with full message (including newlines)
        const message = messageLines.join("\n");
        if (message) {
          commits.push({ hash, message });
        }

        // Skip to the end of this commit's message
        i = j - 1;
      }
    }

    // Limit commits
    if (commits.length > maxCommits) {
      warn(
        `Limited analysis to last ${maxCommits} commits (found ${commits.length} total)`
      );
      return commits.slice(0, maxCommits);
    }

    return commits;
  } catch (error) {
    throw new Error(
      `Failed to get commit log: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function getRecommendedBump(
  pkgName: string,
  pkgDir: string,
  config: Config,
  analyzer?: CommitAnalyzer
): Promise<CommitAnalysisResult> {
  // Configuration options with defaults
  const maxCommits = config.auto?.maxCommits ?? 100;
  const preset = config.auto?.preset ?? "conventionalcommits";

  // Get analyzer function (use provided one or default)
  const analyzeCommits =
    analyzer || config.auto?.analyzer || (await getDefaultAnalyzer());

  try {
    // Get the most recent tag for this package
    const lastTag = getLastTag(pkgName);

    if (!lastTag) {
      info(
        `No previous tag found for ${pkgName}, treating as initial release (patch)`
      );
      return { bump: "patch" };
    }

    // Get commits since the tag
    let commits: Commit[] = [];
    try {
      commits = getCommitsSinceTag(lastTag, pkgDir, maxCommits);
    } catch (error) {
      throw new CommitAnalysisError(
        `Failed to get commit log: ${
          error instanceof Error ? error.message : String(error)
        }`,
        pkgName,
        error
      );
    }

    if (commits.length === 0) {
      info(
        `No commits found for ${pkgName} since ${lastTag}, skipping package`
      );
      return { bump: null };
    }

    // Analyze conventional commits (including breaking changes)
    const result = await analyzeCommits(commits, preset);
    if (result) {
      // Check if this package is mentioned in any commit scope (anywhere in the message)
      const isPackageMentioned = commits.some((commit) => {
        // Look for the package name in any scope within the commit message
        // Handle scopes like @author/pkg-b or just pkg-b
        const scopeMatches = commit.message.matchAll(/[a-z]+\(([^)]+)\)/g);
        for (const match of scopeMatches) {
          const scope = match[1];
          // Check if the scope matches the package name (with or without @ prefix)
          if (scope === pkgName || scope.endsWith(`/${pkgName}`)) {
            return true;
          }
        }
        return false;
      });

      // Check if all commits are unscoped (no scopes at all)
      const allCommitsUnscoped = commits.every((commit) => {
        return !commit.message.match(/[a-z]+\(([^)]+)\)/);
      });

      let finalBump = result;

      // Apply scope-based logic: downgrade bumps for affected but not mentioned packages
      // But only if there are scoped commits (unscoped commits affect all packages equally)
      if (!isPackageMentioned && !allCommitsUnscoped) {
        if (result === "major") {
          finalBump = "patch"; // Downgrade major to patch for non-mentioned packages
          info(
            `Package ${pkgName} affected by breaking change but not mentioned in scope, downgrading to patch`
          );
        } else if (result === "minor") {
          finalBump = "patch"; // Downgrade minor to patch for non-mentioned packages
          info(
            `Package ${pkgName} affected by feature but not mentioned in scope, downgrading to patch`
          );
        }
        // Keep patch and null as-is
      }

      if (finalBump === "major") {
        info(`BREAKING CHANGE detected in ${pkgName}, recommending major bump`);
      } else {
        info(`Commit analysis for ${pkgName}: ${finalBump} bump recommended`);
      }
      return { bump: finalBump };
    }

    info(`No conventional commits found for ${pkgName}, skipping package`);
    return { bump: null }; // Skip package
  } catch (error) {
    if (error instanceof CommitAnalysisError) {
      warn(error.message);
    } else {
      warn(
        `Unexpected error analyzing commits for ${pkgName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    warn(`Falling back to skipping package ${pkgName}`);
    return { bump: null }; // Skip package
  }
}
