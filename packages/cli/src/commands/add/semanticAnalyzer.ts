import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { CommitAnalysisError } from "./auto-mode";
import { VersionType } from "@changesets/types";

// Use analyzeCommits to determine the recommended bump type
export async function analyzeConventionalCommits(
  commits: Array<{ hash: string; message: string }>,
  preset: string
): Promise<VersionType | null> {
  try {
    const result = await analyzeCommits(
      { preset },
      {
        commits,
        logger: { log: () => {} },
        cwd: process.cwd(),
        env: process.env,
      }
    );
    return result;
  } catch (error) {
    throw new CommitAnalysisError(
      `Failed to analyze commits: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "unknown",
      error
    );
  }
}
